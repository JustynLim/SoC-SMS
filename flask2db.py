from flask import Flask, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required, JWTManager, set_access_cookies
import datetime,hashlib,logging,os,pyotp,socket,sqlite3,uuid
#from contextlib import closing
from datetime import datetime, timedelta
from dotenv import load_dotenv, set_key
from flask_cors import CORS

# Preserve variables in case disabling 2FA secret
PRESERVE_VARS = [
    'PATH',                     # System-critical (avoid breaking shell access)
    'JWT_SECRET_KEY'            # Preserve existing session
    # <-- Add other variables as needed
]  

def read_env():
    global os
    """Manually reload environment variables from .env file to avoid caching."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        return

    current_env = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key_value = line.split('=', 1)
                if len(key_value) == 2:
                    key, value = key_value
                    current_env[key.strip()] = value.strip().strip('\'"')
                    #value = value.strip().strip('\'"')  # Only read value without symbols
                    #os.environ[key] = value#.strip() # Ensure no extra whitespace
    
    # Delete any existing vars that aren't in the new .env (or are commented out)
    for key in list(os.environ.keys()):
        if key not in current_env and key not in PRESERVE_VARS:
            del os.environ[key]

    # Update with new values
    os.environ.update(current_env)                   

def get_latest_env(key, default=None):
    read_env()
    return os.getenv(key, default)

#load_dotenv()
app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
jwt = JWTManager(app)

# def find_free_port():
#     with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
#         s.bind(('', 0))
#         return s.getsockname()[1]

# Database setup
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS USERS (
        EMAIL TEXT UNIQUE,
        PASSWORD_HASH TEXT,
        SALTED_PASSWORD TEXT,
        IS_ADMIN BOOLEAN DEFAULT FALSE,
        HAS_VERIFIED_2FA BOOLEAN DEFAULT FALSE,
        CREATED_AT TIMESTAMP
    )
    """)
    conn.commit()
    conn.close()

init_db()

def encrypt_pw(salt, password):
    return hashlib.sha512((salt + password).encode()).hexdigest()

def update_env_secret(secret):
    """Persist secret to .env file"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    set_key(env_path, 'SHARED_2FA_SECRET', secret)
    os.environ['SHARED_2FA_SECRET'] = secret

# Set up logging (you can configure the level and format as per your needs)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/api/check-setup', methods=['GET'])
def check_setup():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Check if any users exist
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]

    # Check if admin has completed 2FA setup
    if user_count > 0:
        cursor.execute("""
                SELECT HAS_VERIFIED_2FA FROM users 
                WHERE IS_ADMIN = TRUE 
                ORDER BY CREATED_AT LIMIT 1
            """)
    admin_2fa_status = cursor.fetchone()[0] > 0
    needs_2fa_setup = not (admin_2fa_status and admin_2fa_status[0])
    
    return jsonify({
        "shouldSetup": user_count == 0,
        "needs2FASetup": needs_2fa_setup,
        "userCount": user_count
    })

@app.route('/api/check-first-user', methods=['GET'])
def check_first_user():
    # Check if SHARED_2FA_SECRET exists in the environment variables
    is_first_user = not bool(os.getenv('SHARED_2FA_SECRET'))
    return jsonify({"isFirstUser": is_first_user})

# Registration Endpoint

@app.route('/api/setup', methods=['POST'])
def setup():
    try:
        data = request.get_json()
        logging.debug(f"Received registration data: {data}")  # Log incoming data
        print(f"Received registration data: {data}")
        email = data.get('email', '').lower().strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()  # <-- FIXED
        #two_fa_code = data.get('twoFACode', '').strip()

        shared_secret = get_latest_env('SHARED_2FA_SECRET')     # Reloads env variables

        # Validate input
        if not all([email, password, confirm_password]):
            logging.error("All fields are required.")
            return jsonify({"error": "All fields are required"}), 400

        # Check if first registration
        #is_first_user = False
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()

        # Check if any user exists
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]

        is_first_user = user_count == 0

        # Shared secret logic
        shared_secret = os.getenv('SHARED_2FA_SECRET')
        if is_first_user:
            if not shared_secret:
                shared_secret = pyotp.random_base32()
                update_env_secret(shared_secret)
                logging.debug(f"First user detected. Shared secret generated: {shared_secret}")
        else:
            if not shared_secret:
                logging.error("Shared 2FA secret missing for non-initial registration.")
                return jsonify({"error": "Server configuration error"}), 500


        # Create user
        salt = uuid.uuid4().hex
        created_at = datetime.now().isoformat()
        has_verified_2fa = False
        
        cursor.execute("""
            INSERT INTO users 
            (email, password_hash, SALTED_PASSWORD, is_admin, has_verified_2fa, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            email,
            encrypt_pw(salt, password),
            salt,
            is_first_user,
            has_verified_2fa,
            created_at
        ))

        conn.commit()
        conn.close()
        logging.info(f"User {email} registered successfully. Admin: {is_first_user}")

        # Return provisioning URI if admin
        totp = pyotp.TOTP(shared_secret)
        qr_url = totp.provisioning_uri(name=email, issuer_name="FYP")   # Change issuer name before deploying

        return jsonify({
            "success": True,
            "isAdmin": is_first_user,
            "qrUrl": qr_url,
            "manualCode": shared_secret,
            "message": "Admin created" if is_first_user else "User registered"
        }), 201

    except sqlite3.Error as e:
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500
    

@app.route('/api/register', methods=['POST'])
def register():
    #read_env()
    try:
        data = request.get_json()
        logging.debug(f"Received registration data: {data}")  # Log incoming data
        print(f"Received registration data: {data}")
        email = data.get('email', '').lower().strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()  # <-- FIXED
        two_fa_code = data.get('twoFACode', '').strip()

        shared_secret = get_latest_env('SHARED_2FA_SECRET')    # Reloads env variables

        # Validate input
        if not all([email, password, confirm_password]):
            logging.error("All fields are required.")
            return jsonify({"error": "All fields are required"}), 400

        # Check if first registration
        #is_first_user = False
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()

        # Check if any user exists
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]

        is_first_user = user_count == 0

        # Shared secret logic
        #shared_secret = os.getenv('SHARED_2FA_SECRET')


        # if is_first_user:
        #     if not shared_secret:
        #         shared_secret = pyotp.random_base32()
        #         update_env_secret(shared_secret)
        #         logging.debug(f"First user detected. Shared secret generated: {shared_secret}")
        # else:
        #     if not shared_secret:
        #         logging.error("Shared 2FA secret missing for non-initial registration.")
        #         return jsonify({"error": "Server configuration error"}), 500
            
        # if not is_first_user:
        #     totp = pyotp.TOTP(shared_secret)
        #     if not totp.verify(two_fa_code, valid_window=1):
        #         logging.error("Invalid 2FA code (line:202)")
        #         conn.close()
        #         return jsonify({"error": "Invalid 2FA code"}), 400



        # shared_secret = os.getenv('SHARED_2FA_SECRET')
        
        # if not shared_secret:
        #     shared_secret = pyotp.random_base32()
        #     update_env_secret(shared_secret)
        #     is_first_user = True
        #     logging.debug(f"First user detected. Shared secret generated: {shared_secret}")

            # Require 2FA for all users after the first
        if not two_fa_code:
            logging.error("2FA code is required for existing users.")
            conn.close()
            return jsonify({"error": "2FA code is required"}), 400
        # if not is_first_user and not two_fa_code:
        #         logging.error("2FA code is required for existing users.")
        #         return jsonify({"error": "2FA code is required"}), 400

        # Verify 2FA code



        totp = pyotp.TOTP(shared_secret)
        if not totp.verify(two_fa_code, valid_window=1):
            logging.error("Invalid 2FA code.")
            conn.close
            return jsonify({"error": "Invalid 2FA code"}), 400




        # # Database operations
        # conn = sqlite3.connect('database.db')
        # cursor = conn.cursor()

        # Check if email exists
        cursor.execute("SELECT email FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            logging.error(f"Email already registered: {email}")
            return jsonify({"error": "Email already registered"}), 409

        # Create user
        salt = uuid.uuid4().hex
        created_at = datetime.now().isoformat()
        has_verified_2fa = True
        
        cursor.execute("""
            INSERT INTO users 
            (email, password_hash, salted_password, is_admin, has_verified_2fa, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            email,
            encrypt_pw(salt, password),
            salt,
            is_first_user,
            has_verified_2fa,
            created_at
        ))

        conn.commit()
        conn.close()
        # logging.info(f"User {email} registered successfully. Admin: {is_first_user}")

        # # Return provisioning URI if admin
        # totp = pyotp.TOTP(shared_secret)
        # qr_url = totp.provisioning_uri(name=email, issuer_name="YourApp")

        # return jsonify({
        #     "success": True,
        #     "isAdmin": is_first_user,
        #     "qrUrl": qr_url,
        #     "manualCode": shared_secret,
        #     "message": "Admin created" if is_first_user else "User registered"
        # }), 201

    except sqlite3.Error as e:
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/api/verify-2fa-setup', methods=['POST'])
def verify_admin_2fa_setup():
    try:
        data = request.get_json(force=True)
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()

        if not email or not code:
            return jsonify({"error:" "Email and 2FA code are required"}), 400
        
        shared_secret = os.getenv('SHARED_2FA_SECRET')
        if not shared_secret:
            return jsonify({"error": "2FA secret not initialized"}), 500
        
        totp = pyotp.TOTP(shared_secret)
        if not totp.verify(code, valid_window=1):
            return jsonify({"error": "Invalid 2FA code"}), 400
        
        # Update verification status in db
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE USERS SET HAS_VERIFIED_2FA = TRUE 
            WHERE EMAIL = ?
        """, (email,))
        conn.commit()
        conn.close()

        return jsonify({"message": "2FA verified successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

#   Not using yet!
@app.route('/admin/invite-token', methods=['GET'])
@jwt_required()
def generate_invite_token():
    current_user = get_jwt_identity()
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT IS_ADMIN FROM USERS WHERE EMAIL = ?", (current_user,))
    if not cursor.fetchone()[0]:
        return jsonify({"error": "Admin access required"}), 403

    token = create_access_token(
        identity={"purpose": "invite"},
        expires_delta=timedelta(hours=24))
    
    return jsonify({
        "inviteToken": token,
        "sharedSecret": os.getenv('SHARED_2FA_SECRET')
    })

# Login Endpoint
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '').strip()
    two_fa_code = data.get('twoFACode', '').strip()

    # Load fresh secret (fail fast if missing)
    shared_secret = get_latest_env('SHARED_2FA_SECRET')
    if not shared_secret:
        return jsonify({"error": "2FA secret not configured"}), 500

    # Verify credentials
    conn = sqlite3.connect('database.db')
    try:
        user = conn.execute("""
            SELECT PASSWORD_HASH, SALTED_PASSWORD FROM USERS 
            WHERE EMAIL = ?
        """, (email,)).fetchone()

        if not user or encrypt_pw(user[1], password) != user[0]:
            return jsonify({"error": "Invalid credentials"}), 401

        # Verify 2FA
        try:
            totp = pyotp.TOTP(shared_secret)
            if not totp.verify(two_fa_code):
                return jsonify({"error": "Invalid 2FA code"}), 400
        except Exception as e:
            logging.error(f"2FA verification error: {str(e)}")
            return jsonify({"error": "2FA processing failed"}), 500

        # Generate JWT
        access_token = create_access_token(identity=email)
        return jsonify({
            "accessToken": access_token,
            "email": email
        })
    finally:
        conn.close()

# Protected Homepage Endpoint
@app.route('/api/home', methods=['GET'])
@jwt_required()
def home():
    current_user = get_jwt_identity()
    return jsonify({"message": f"Welcome {current_user}!"})


if __name__ == '__main__':
    #port = find_free_port()
    #print(f"Running on port {port}")
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
    jwt = JWTManager(app)
    app.run(host='0.0.0.0', port= 5001, debug=True)

logging.info("Server started")