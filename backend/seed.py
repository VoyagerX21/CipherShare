import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.user import User
from backend.app.services.auth_service import hash_password
from backend.app.routes.demo_routes import DEMO_USERS

def run_seed():
    app = create_app()
    with app.app_context():
        print("[+] Seeding CipherShare demo accounts...")
        for du in DEMO_USERS:
            existing = User.query.filter_by(email=du['email']).first()
            if not existing:
                u = User(
                    name=du['name'],
                    email=du['email'],
                    password_hash=hash_password(du['password']),
                    is_active=True
                )
                db.session.add(u)
                print(f"  [+] Created user: {du['name']} <{du['email']}>")
            else:
                existing.password_hash = hash_password(du['password'])
                existing.is_active = True
                print(f"  [*] Updated user: {du['name']} <{du['email']}>")
        db.session.commit()
        print("[OK] Demo accounts seeded successfully!")
        print("\nAccounts:")
        for du in DEMO_USERS:
            print(f"  * {du['role']}: {du['email']} | Password: {du['password']}")

if __name__ == '__main__':
    run_seed()
