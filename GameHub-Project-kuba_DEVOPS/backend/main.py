"""
GameHub Backend - Flask Application
Configured for Google App Engine deployment with Firestore
JWT Authentication

CHANGELOG (patch 2026-04):
- Hasła hashowane przez bcrypt (zamiast SHA256 + statyczna sól)
- verified=0 przy rejestracji (poprzednio 1 - omijało weryfikację email)
- SMTP password z env var SMTP_PASSWORD (poprzednio plaintext w kodzie)
- get_next_id() teraz transakcyjny (fix race condition)
- SECRET_KEY wymagany z env w produkcji
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
from functools import wraps
import os
import secrets
import smtplib
import jwt
import bcrypt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.cloud import videointelligence_v1 as vi

app = Flask(__name__)

# ─── Konfiguracja (env vars) ──────────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if os.environ.get('GAE_ENV', '').startswith('standard'):
        # W produkcji App Engine brak SECRET_KEY to fatal error
        raise RuntimeError('SECRET_KEY env var is required in production')
    SECRET_KEY = 'dev-secret-key-only-for-local'  # tylko lokalnie

SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp-relay.brevo.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_FROM = os.environ.get('SMTP_FROM', 'GameHub <noreply@gam3hub.pl>')
APP_FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
RECAPTCHA_SECRET = os.environ.get('RECAPTCHA_SECRET')

CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",
    "https://gamehub-493009.web.app",
    "https://gamehub-493009.firebaseapp.com",
    "https://gam3hub.pl",
    "https://www.gam3hub.pl",
], allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# ─── Firestore Client ─────────────────────────────────────────────────────────
from google.cloud import firestore
from google.cloud import storage
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'gamehub-493009-videos')
PROJECT_ID = os.environ.get('GOOGLE_CLOUD_PROJECT', 'gamehub-493009')
import google.auth
import google.auth.transport.requests

db = firestore.Client()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Bcrypt z automatyczną solą dla każdego hasła."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Sprawdza hasło; obsługuje też stare SHA256 hashe (migration-friendly)."""
    # Stare hashe (SHA256 + stała sól) - 64 znaki hex, bez prefiksu $2
    if len(hashed) == 64 and not hashed.startswith('$2'):
        import hashlib
        legacy_salt = "gamehub_salt_2024"
        return hashlib.sha256(f"{legacy_salt}{password}".encode()).hexdigest() == hashed
    # Nowe hashe bcrypt
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def get_next_id(collection: str) -> int:
    """Atomic increment - bez race condition przy jednoczesnych requestach."""
    counter_ref = db.collection('counters').document(collection)

    @firestore.transactional
    def _increment(transaction):
        snap = counter_ref.get(transaction=transaction)
        if not snap.exists:
            transaction.set(counter_ref, {'value': 1})
            return 1
        current = snap.to_dict()['value']
        new_value = current + 1
        transaction.update(counter_ref, {'value': new_value})
        return new_value

    return _increment(db.transaction())


def generate_token(user_id: int, nick: str) -> str:
    payload = {
        'user_id': user_id,
        'nick': nick,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def get_current_user():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


def generate_auth_code() -> str:
    return secrets.token_urlsafe(32)


def send_verification_email(to_email: str, code: str, user_id: int):
    if not SMTP_USER or not SMTP_PASSWORD:
        # Fail-loud w produkcji, fail-soft lokalnie
        print(f"[WARN] SMTP_PASSWORD not set - skipping email to {to_email}", flush=True)
        print(f"[DEV] Verification link: {APP_FRONTEND_URL}/verify?code={code}&user_id={user_id}", flush=True)
        return

    verification_link = f"{APP_FRONTEND_URL}/verify?code={code}&user_id={user_id}"
    msg = MIMEMultipart()
    msg['From'] = SMTP_FROM
    msg['To'] = to_email
    msg['Subject'] = 'Zweryfikuj konto GameHub'
    body = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #00ff87;">Witaj w GameHub!</h2>
        <p>Kliknij przycisk poniżej aby zweryfikować swoje konto (link ważny 30 minut):</p>
        <a href="{verification_link}"
           style="display:inline-block;background:#00ff87;color:#000;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
            Zweryfikuj konto
        </a>
        <p style="color:#888;font-size:12px;">Lub skopiuj link: {verification_link}</p>
    </div>
    """
    msg.attach(MIMEText(body, 'html'))
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
        server.quit()
        print(f"Email wysłany do {to_email}", flush=True)
    except Exception as e:
        print(f"Email error: {e}", flush=True)


# ─── GCS Helpers ──────────────────────────────────────────────────────────────

gcs = storage.Client()

def generate_signed_url(blob_name: str, content_type: str = 'video/mp4') -> str:
    import google.auth
    import google.auth.transport.requests
    from google.auth import impersonated_credentials
    
    credentials, project = google.auth.default()
    auth_request = google.auth.transport.requests.Request()
    credentials.refresh(auth_request)
    
    bucket = gcs.bucket(GCS_BUCKET)
    blob = bucket.blob(blob_name)
    
    service_account_email = f"{PROJECT_ID}@appspot.gserviceaccount.com"
    
    return blob.generate_signed_url(
        version='v4',
        expiration=timedelta(minutes=60),
        method='PUT',
        content_type=content_type,
        service_account_email=service_account_email,
        access_token=credentials.token,
    )

def get_public_url(blob_name: str) -> str:
    """Zwraca ścieżkę bloba — URL generowany dynamicznie przy get_posts."""
    return blob_name

def delete_gcs_blob(blob_name: str):
    try:
        gcs.bucket(GCS_BUCKET).blob(blob_name).delete()
    except Exception as e:
        print(f"GCS delete error: {e}", flush=True)

def get_signed_read_url(blob_name: str, expiration_hours: int = 1) -> str:
    """Generuje signed URL do odczytu wideo."""
    try:
        credentials, _ = google.auth.default()
        auth_request = google.auth.transport.requests.Request()
        credentials.refresh(auth_request)
        bucket = gcs.bucket(GCS_BUCKET)
        blob = bucket.blob(blob_name)
        return blob.generate_signed_url(
            version='v4',
            expiration=timedelta(hours=expiration_hours),
            method='GET',
            service_account_email=f"{PROJECT_ID}@appspot.gserviceaccount.com",
            access_token=credentials.token,
        )
    except Exception as e:
        print(f"Signed URL error: {e}", flush=True)
        return ''

def get_or_create_category(category_name: str) -> int:
    name = category_name or 'Pozostałe'
    cats = list(db.collection('categories')
        .where(filter=firestore.FieldFilter('category_name', '==', name)).get())
    if cats:
        return cats[0].to_dict()['id']
    cat_id = get_next_id('categories')
    db.collection('categories').document(str(cat_id)).set({
        'id': cat_id, 'category_name': name
    })
    return cat_id

# ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

import requests as http_requests

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')
    nick = data.get('nick', '').strip()

    # Weryfikacja reCAPTCHA - jeśli skonfigurowana, token jest obowiązkowy
    captcha_token = data.get('captchaToken')
    if RECAPTCHA_SECRET:
        if not captcha_token:
            return jsonify({'error': 'Weryfikacja reCAPTCHA nieudana'}), 400
        try:
            r = http_requests.post('https://www.google.com/recaptcha/api/siteverify', data={
                'secret': RECAPTCHA_SECRET,
                'response': captcha_token
            }, timeout=5)
            captcha_ok = r.json().get('success')
        except Exception as e:
            print(f"reCAPTCHA error: {e}", flush=True)
            captcha_ok = False
        if not captcha_ok:
            return jsonify({'error': 'Weryfikacja reCAPTCHA nieudana'}), 400

    if not email:
        return jsonify({'error': 'Email jest wymagany'}), 400
    import re
    password_regex = re.compile(r'^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|]).{8,}$')
    if not password or not password_regex.match(password):
        return jsonify({'error': 'Hasło musi mieć min. 8 znaków, wielką literę, cyfrę i znak specjalny'}), 400
    if password != confirm_password:
        return jsonify({'error': 'Hasła nie są zgodne'}), 400
    if not nick or len(nick) < 3:
        return jsonify({'error': 'Nick musi mieć minimum 3 znaki'}), 400

    users_ref = db.collection('users')
    if list(users_ref.where(filter=firestore.FieldFilter('email', '==', email)).get()):
        return jsonify({'error': 'Email jest już zajęty'}), 409
    if list(users_ref.where(filter=firestore.FieldFilter('nick', '==', nick)).get()):
        return jsonify({'error': 'Nick jest już zajęty'}), 409

    user_id = get_next_id('users')
    user_data = {
        'id': user_id,
        'email': email,
        'password': hash_password(password),
        'nick': nick,
        'verified': 0,  # ← patch: wymagana weryfikacja email
        'created_at': datetime.utcnow().isoformat()
    }
    db.collection('users').document(str(user_id)).set(user_data)

    code = generate_auth_code()
    code_id = get_next_id('temp_auth_codes')
    db.collection('temp_auth_codes').document(str(code_id)).set({
        'id': code_id,
        'id_user': user_id,
        'code': code,
        'expires_at': (datetime.utcnow() + timedelta(minutes=30)).isoformat()
    })

    send_verification_email(email, code, user_id)

    return jsonify({
        'message': 'Konto utworzone. Sprawdź email aby zweryfikować konto.'
    }), 201


@app.route('/api/auth/verify', methods=['GET'])
def verify_email():
    code = request.args.get('code')
    user_id = request.args.get('user_id')

    if not code or not user_id or not user_id.isdigit():
        return jsonify({'error': 'Nieprawidłowy link weryfikacyjny'}), 400

    codes = list(db.collection('temp_auth_codes')
        .where(filter=firestore.FieldFilter('code', '==', code))
        .where(filter=firestore.FieldFilter('id_user', '==', int(user_id)))
        .get())

    if not codes:
        return jsonify({'error': 'Link jest nieprawidłowy lub wygasł'}), 400

    code_doc = codes[0]
    code_data = code_doc.to_dict()
    expires_at = datetime.fromisoformat(code_data['expires_at'])

    if datetime.utcnow() > expires_at:
        db.collection('users').document(str(user_id)).delete()
        db.collection('temp_auth_codes').document(code_doc.id).delete()
        return jsonify({'error': 'Link wygasł. Zarejestruj się ponownie.'}), 400

    db.collection('users').document(str(user_id)).update({'verified': 1})
    db.collection('temp_auth_codes').document(code_doc.id).delete()
    return jsonify({'message': 'Email zweryfikowany. Możesz się zalogować.'}), 200


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Uzupełnij dane poprawnie'}), 400

    users = list(db.collection('users')
        .where(filter=firestore.FieldFilter('email', '==', email)).get())

    if not users:
        return jsonify({'error': 'Uzupełnij dane poprawnie'}), 401

    user_doc = users[0]
    user = user_doc.to_dict()

    if not verify_password(password, user['password']):
        return jsonify({'error': 'Uzupełnij dane poprawnie'}), 401

    # Jeśli user miał stary SHA256 hash, przemigruj go do bcrypt przy logowaniu
    if len(user['password']) == 64 and not user['password'].startswith('$2'):
        user_doc.reference.update({'password': hash_password(password)})

    if user['verified'] == 0:
        return jsonify({'error': 'Zweryfikuj adres e-mail'}), 403

    token = generate_token(user['id'], user['nick'])

    return jsonify({
        'message': 'Zalogowano',
        'token': token,
        'user': {'id': user['id'], 'nick': user['nick'], 'email': user['email']}
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Wylogowano'}), 200


@app.route('/api/auth/me', methods=['GET'])
@require_auth
def me():
    user_data = get_current_user()
    user_id = user_data['user_id']
    user_doc = db.collection('users').document(str(user_id)).get()
    if not user_doc.exists:
        return jsonify({'error': 'Użytkownik nie istnieje'}), 404
    user = user_doc.to_dict()
    return jsonify({'user': {'id': user['id'], 'nick': user['nick'], 'email': user['email']}}), 200


# ─── CATEGORIES ───────────────────────────────────────────────────────────────

@app.route('/api/categories', methods=['GET'])
def get_categories():
    cats = db.collection('categories').get()
    result = sorted([c.to_dict() for c in cats], key=lambda x: x.get('category_name', ''))
    return jsonify({'categories': result}), 200


# ─── POSTS ────────────────────────────────────────────────────────────────────

@app.route('/api/posts', methods=['GET'])
def get_posts():
    page = int(request.args.get('page', 1))
    category_id = request.args.get('category_id')
    liked_only = request.args.get('liked') == 'true'
    my_only = request.args.get('my') == 'true'
    per_page = 10
    current_user = get_current_user()
    user_id = current_user['user_id'] if current_user else None

    posts_list = [p.to_dict() for p in db.collection('posts')
                  .where(filter=firestore.FieldFilter('active', '==', 1)).get()]

    if category_id and category_id != 'all':
        posts_list = [p for p in posts_list if str(p.get('id_category')) == str(category_id)]

    if liked_only and user_id:
        liked_post_ids = [
            l.to_dict()['id_post']
            for l in db.collection('likes')
                .where(filter=firestore.FieldFilter('id_user', '==', user_id)).get()
        ]
        posts_list = [p for p in posts_list if p['id'] in liked_post_ids]

    if my_only and user_id:
        posts_list = [p for p in posts_list if p['id_user'] == user_id]

    posts_list.sort(key=lambda x: x.get('post_datetime', ''), reverse=True)
    total = len(posts_list)
    start = (page - 1) * per_page
    page_posts = posts_list[start:start + per_page]

    for post in page_posts:
        # Generuj świeże signed URLs dla wideo
        if post.get('video_location'):
            post['video_location'] = get_signed_read_url(post['video_location'])
        if post.get('thumbnail_location'):
            post['thumbnail_location'] = get_signed_read_url(post['thumbnail_location'])
        user_doc = db.collection('users').document(str(post['id_user'])).get()
        if user_doc.exists:
            post['author_nick'] = user_doc.to_dict()['nick']
        if user_id:
            like_check = list(db.collection('likes')
                .where(filter=firestore.FieldFilter('id_user', '==', user_id))
                .where(filter=firestore.FieldFilter('id_post', '==', post['id'])).get())
            post['user_liked'] = len(like_check) > 0
        else:
            post['user_liked'] = False

    return jsonify({
        'posts': page_posts,
        'total': total,
        'page': page,
        'pages': (total + per_page - 1) // per_page
    }), 200


@app.route('/api/posts/reserve', methods=['POST'])
@require_auth
def reserve_post():
    current_user = get_current_user()
    user_id = current_user['user_id']
    post_id = get_next_id('posts')
    db.collection('posts').document(str(post_id)).set({
        'id': post_id,
        'id_user': user_id,
        'id_category': None,
        'video_location': None,
        'thumbnail_location': None,
        'title': '',
        'description': '',
        'post_datetime': datetime.utcnow().isoformat(),
        'like_count': 0,
        'active': 0
    })
    return jsonify({'post_id': post_id}), 201


@app.route('/api/posts/<int:post_id>/upload-url', methods=['POST'])
@require_auth
def get_upload_url(post_id):
    """Generuje signed URL do bezpośredniego uploadu na GCS (do 150MB)."""
    current_user = get_current_user()
    post_doc = db.collection('posts').document(str(post_id)).get()
    if not post_doc.exists:
        return jsonify({'error': 'Post nie istnieje'}), 404
    post = post_doc.to_dict()
    if post['id_user'] != current_user['user_id']:
        return jsonify({'error': 'Brak uprawnień'}), 403
    # Upload tylko do nieopublikowanej rezerwacji - nie da się podmienić wideo po moderacji
    if post['active'] != 0:
        return jsonify({'error': 'Nie można zmienić wideo opublikowanego posta'}), 409

    data = request.get_json() or {}
    filename = data.get('filename', f'{post_id}.mp4')

    if not filename.lower().endswith('.mp4'):
        return jsonify({'error': 'Dozwolony tylko format .mp4'}), 400

    video_blob = f'videos/{post_id}/{post_id}.mp4'
    thumbnail_blob = f'videos/{post_id}/{post_id}Thumbnail.jpg'

    signed_url = generate_signed_url(video_blob)
    db.collection('posts').document(str(post_id)).update({
    'video_location': get_public_url(video_blob),
    'thumbnail_location': get_public_url(thumbnail_blob),
    'analysis_status': 'pending',
})

    return jsonify({
    'signed_url': signed_url,
    'video_url': get_public_url(video_blob),
    'thumbnail_url': get_public_url(thumbnail_blob),
}), 200



LABEL_TO_CATEGORY = {
    # GTA
    "grand theft auto": "GTA",
    "gta": "GTA",
    "los santos": "GTA",
    "rockstar": "GTA",
    "open world crime": "GTA",

    # CS2
    "counter-strike": "CS",
    "csgo": "CS",
    "cs2": "CS",
    "tactical shooter": "CS",
    "M4A1-S": "CS",
    "AK-47": "CS",
    "M4A4": "CS",
    "USP-S": "CS",
    "GLOCK-18": "CS",
    "AWP": "CS",

    # Fortnite
    "fortnite": "FORTNITE",
    "battle royale": "FORTNITE",
    "building shooter": "FORTNITE",
    "epic games": "FORTNITE",

    # League of Legends
    "league of legends": "LOL",
    "lol": "LOL",
    "moba": "LOL",
    "multiplayer online battle arena": "LOL",
    "summoners rift": "LOL",
    "riot games": "LOL",

    # Minecraft
    "minecraft": "MINECRAFT",
    "sandbox": "MINECRAFT",
    "building blocks": "MINECRAFT",
    "crafting": "MINECRAFT",
    "creeper": "MINECRAFT",
    "block game": "MINECRAFT",

    # Valorant
    "valorant": "VALORANT",
    "tactical fps": "VALORANT",
    "agent ability": "VALORANT",

    # Wiedźmin
    "witcher": "WIEDŹMIN",
    "geralt": "WIEDŹMIN",
    "fantasy role playing": "WIEDŹMIN",
    "cd projekt": "WIEDŹMIN",
    "monster hunting": "WIEDŹMIN",

    # Cyberpunk
    "cyberpunk": "CYBERPUNK",
    "night city": "CYBERPUNK",
    "cyberpunk 2077": "CYBERPUNK",
    "futuristic city": "CYBERPUNK",
    "neon city": "CYBERPUNK",

    # Forza Horizon
    "forza": "FORZA HORIZON",
    "forza horizon": "FORZA HORIZON",
    "racing": "FORZA HORIZON",
    "motorsport": "FORZA HORIZON",
    "car racing game": "FORZA HORIZON",
    "open world racing": "FORZA HORIZON",

    # Roblox
    "roblox": "ROBLOX",
    "user generated game": "ROBLOX",
    "roblox studio": "ROBLOX",
}

def analyze_video_intelligence(blob_name: str) -> str | None:
    client = vi.VideoIntelligenceServiceClient()
    gcs_uri = f"gs://{GCS_BUCKET}/{blob_name}"
    features = [
        vi.Feature.LABEL_DETECTION,
        vi.Feature.EXPLICIT_CONTENT_DETECTION,
    ]
    operation = client.annotate_video(request={
        "input_uri": gcs_uri,
        "features": features,
    })
    print(f"[VideoIntelligence] Analiza {blob_name} rozpoczęta...", flush=True)
    result = operation.result(timeout=300)
    annotation = result.annotation_results[0]

    # Explicit content check
    for frame in annotation.explicit_annotation.frames:
        likelihood = vi.Likelihood(frame.pornography_likelihood).name
        if likelihood in ("LIKELY", "VERY_LIKELY"):
            return "__EXPLICIT__"

    # Label detection → kategoria
    scores = {}
    for label in annotation.segment_label_annotations:
        name = label.entity.description.lower()
        confidence = max((s.confidence for s in label.segments), default=0.0)
        if confidence >= 0.6:
            scores[name] = confidence

    for label in sorted(scores, key=scores.__getitem__, reverse=True):
        for keyword, category in LABEL_TO_CATEGORY.items():
            if keyword in label:
                return category

    return None



@app.route('/api/posts/<int:post_id>/confirm', methods=['POST'])
@require_auth
def confirm_upload(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']

    post_doc = db.collection('posts').document(str(post_id)).get()
    if not post_doc.exists:
        return jsonify({'error': 'Post nie istnieje'}), 404
    post = post_doc.to_dict()
    if post['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403
    if post['active'] != 0:
        return jsonify({'error': 'Post został już przetworzony'}), 409

    video_blob = f'videos/{post_id}/{post_id}.mp4'

    try:
        category_name = analyze_video_intelligence(video_blob)
    except Exception as e:
        print(f"[VideoIntelligence] Błąd: {e}", flush=True)
        category_name = None

    if category_name == "__EXPLICIT__":
        delete_gcs_blob(video_blob)
        db.collection('posts').document(str(post_id)).update({
            'active': -1,
            'analysis_status': 'rejected_explicit',
        })
        return jsonify({'error': 'Film zawiera nieodpowiednie treści i został odrzucony.'}), 422

    category_id = get_or_create_category(category_name)
    db.collection('posts').document(str(post_id)).update({
        'id_category': category_id,
        'analysis_status': 'done',
    })

    return jsonify({
        'detected_category': category_name or 'Pozostałe',
        'category_id': category_id,
    }), 200

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
@require_auth
def update_post(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']
    data = request.get_json()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    publish = data.get('publish', False)

    post_doc = db.collection('posts').document(str(post_id)).get()
    if not post_doc.exists:
        return jsonify({'error': 'Post nie istnieje'}), 404

    post = post_doc.to_dict()
    if post['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403

    if not title:
        return jsonify({'error': 'Pole tytuł nie może być puste'}), 400

    if publish:
        if not post.get('video_location'):
            return jsonify({'error': 'Wideo jest wymagane'}), 400
        # Publikacja tylko po przejściu moderacji (/confirm) - blokuje ominięcie analizy
        # i ponowną aktywację odrzuconych postów (active == -1)
        if post['active'] != 0 or post.get('analysis_status') != 'done':
            return jsonify({'error': 'Wideo nie zostało zweryfikowane'}), 400
        db.collection('posts').document(str(post_id)).update({
            'title': title, 'description': description,
            'active': 1, 'post_datetime': datetime.utcnow().isoformat()
        })
    else:
        db.collection('posts').document(str(post_id)).update({
            'title': title, 'description': description
        })

    return jsonify({'message': 'Post zaktualizowany'}), 200


@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@require_auth
def delete_post(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']

    post_doc = db.collection('posts').document(str(post_id)).get()
    if not post_doc.exists:
        return jsonify({'error': 'Post nie istnieje'}), 404

    post = post_doc.to_dict()
    if post['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403

    delete_gcs_blob(f"videos/{post_id}/{post_id}.mp4")
    delete_gcs_blob(f"videos/{post_id}/{post_id}Thumbnail.jpg")

    for like in db.collection('likes').where(filter=firestore.FieldFilter('id_post', '==', post_id)).get():
        like.reference.delete()
    for comment in db.collection('comments').where(filter=firestore.FieldFilter('id_post', '==', post_id)).get():
        comment.reference.delete()

    db.collection('posts').document(str(post_id)).delete()
    return jsonify({'message': 'Post usunięty'}), 200


@app.route('/api/posts/<int:post_id>/cancel', methods=['DELETE'])
@require_auth
def cancel_post_reservation(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']

    post_doc = db.collection('posts').document(str(post_id)).get()
    if not post_doc.exists:
        return jsonify({'message': 'OK'}), 200

    post = post_doc.to_dict()
    if post['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403

    if post['active'] == 0:
        delete_gcs_blob(f"videos/{post_id}/{post_id}.mp4")
        delete_gcs_blob(f"videos/{post_id}/{post_id}Thumbnail.jpg")
        db.collection('posts').document(str(post_id)).delete()

    return jsonify({'message': 'Rezerwacja anulowana'}), 200



# ─── LIKES ────────────────────────────────────────────────────────────────────

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@require_auth
def toggle_like(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']

    existing = list(db.collection('likes')
        .where(filter=firestore.FieldFilter('id_user', '==', user_id))
        .where(filter=firestore.FieldFilter('id_post', '==', post_id)).get())

    post_ref = db.collection('posts').document(str(post_id))

    if existing:
        existing[0].reference.delete()
        post_ref.update({'like_count': firestore.Increment(-1)})
        return jsonify({'liked': False}), 200
    else:
        like_id = get_next_id('likes')
        db.collection('likes').document(str(like_id)).set({
            'id': like_id, 'id_user': user_id, 'id_post': post_id
        })
        post_ref.update({'like_count': firestore.Increment(1)})
        return jsonify({'liked': True}), 200


# ─── COMMENTS ─────────────────────────────────────────────────────────────────

@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
def get_comments(post_id):
    comments = db.collection('comments').where(
        filter=firestore.FieldFilter('id_post', '==', post_id)).get()
    result = []
    for c in comments:
        comment = c.to_dict()
        user_doc = db.collection('users').document(str(comment['id_user'])).get()
        if user_doc.exists:
            comment['author_nick'] = user_doc.to_dict()['nick']
        result.append(comment)
    result.sort(key=lambda x: x.get('comment_datetime', ''))
    return jsonify({'comments': result}), 200


@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
@require_auth
def add_comment(post_id):
    current_user = get_current_user()
    user_id = current_user['user_id']
    nick = current_user['nick']

    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': 'Treść komentarza nie może być pusta'}), 400

    comment_id = get_next_id('comments')
    comment_data = {
        'id': comment_id,
        'id_post': post_id,
        'id_user': user_id,
        'content': content,
        'comment_datetime': datetime.utcnow().isoformat(),
        'author_nick': nick
    }
    db.collection('comments').document(str(comment_id)).set(comment_data)
    return jsonify({'comment': comment_data}), 201

@app.route('/api/posts/<int:post_id>/comments/<int:comment_id>', methods=['PUT'])
@require_auth
def edit_comment(post_id, comment_id):
    current_user = get_current_user()
    user_id = current_user['user_id']
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': 'Treść komentarza nie może być pusta'}), 400

    comment_doc = db.collection('comments').document(str(comment_id)).get()
    if not comment_doc.exists:
        return jsonify({'error': 'Komentarz nie istnieje'}), 404

    comment = comment_doc.to_dict()
    if comment['id_post'] != post_id:
        return jsonify({'error': 'Komentarz nie istnieje'}), 404
    if comment['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403

    db.collection('comments').document(str(comment_id)).update({
        'content': content,
        'comment_datetime': datetime.utcnow().isoformat()
    })
    return jsonify({'message': 'Komentarz zaktualizowany'}), 200


@app.route('/api/posts/<int:post_id>/comments/<int:comment_id>', methods=['DELETE'])
@require_auth
def delete_comment(post_id, comment_id):
    current_user = get_current_user()
    user_id = current_user['user_id']

    comment_doc = db.collection('comments').document(str(comment_id)).get()
    if not comment_doc.exists:
        return jsonify({'error': 'Komentarz nie istnieje'}), 404

    comment = comment_doc.to_dict()
    if comment['id_post'] != post_id:
        return jsonify({'error': 'Komentarz nie istnieje'}), 404
    if comment['id_user'] != user_id:
        return jsonify({'error': 'Brak uprawnień'}), 403

    db.collection('comments').document(str(comment_id)).delete()
    return jsonify({'message': 'Komentarz usunięty'}), 200

# ─── CASINO — leaderboard (top users by casino balance) ───────────────────────

@app.route('/api/casino/leaderboard', methods=['GET'])
def casino_leaderboard():
    """Top 10 graczy po casino_balance. Gracze bez pola pomijani."""
    users = db.collection('users').get()
    entries = []
    for u in users:
        data = u.to_dict()
        balance = data.get('casino_balance')
        if balance is None:
            continue
        entries.append({
            'user_id': data['id'],
            'nick': data['nick'],
            'balance': balance,
        })
    entries.sort(key=lambda x: x['balance'], reverse=True)
    return jsonify({'leaderboard': entries[:10]}), 200


@app.route('/api/casino/state', methods=['GET'])
@require_auth
def get_casino_state():
    """Pobiera aktualny stan casino zalogowanego usera."""
    current_user = get_current_user()
    user_id = current_user['user_id']
    user_doc = db.collection('users').document(str(user_id)).get()
    if not user_doc.exists:
        return jsonify({'error': 'User not found'}), 404
    data = user_doc.to_dict()
    return jsonify({
        'balance': data.get('casino_balance', 1000),
        'history': data.get('casino_history', []),
    }), 200


@app.route('/api/casino/state', methods=['POST'])
@require_auth
def update_casino_state():
    """Aktualizuje balance + historię. UWAGA: klient może to oszukać —
    w wersji produkcyjnej losowanie powinno być po stronie serwera."""
    current_user = get_current_user()
    user_id = current_user['user_id']
    data = request.get_json()
    balance = data.get('balance')
    history = data.get('history', [])

    if not isinstance(balance, int) or balance < 0:
        return jsonify({'error': 'Invalid balance'}), 400

    # Ograniczenie rozmiaru historii do ostatnich 50 wpisów
    history = history[:50]

    db.collection('users').document(str(user_id)).update({
        'casino_balance': balance,
        'casino_history': history,
    })
    return jsonify({'message': 'OK'}), 200


# ─── Static Files ─────────────────────────────────────────────────────────────

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory('uploads', filename)


# ─── App Engine Entry Point ───────────────────────────────────────────────────

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=os.environ.get('FLASK_DEBUG') == '1')
