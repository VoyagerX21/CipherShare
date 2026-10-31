from flask import Flask, jsonify
from backend.app.config import Config
from backend.app.extensions import db, migrate, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        supports_credentials=True
    )

    # Register blueprints
    from backend.app.routes.auth_routes import auth_bp
    from backend.app.routes.key_routes import key_bp
    from backend.app.routes.file_routes import file_bp
    from backend.app.routes.audit_routes import audit_bp
    from backend.app.routes.demo_routes import demo_bp
    from backend.app.routes.health_routes import health_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(key_bp)
    app.register_blueprint(file_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(demo_bp)
    app.register_blueprint(health_bp)

    # Consistent JSON error handlers
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({'error': 'Bad Request', 'message': str(e)}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not Found', 'message': 'Resource not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'error': 'Method Not Allowed', 'message': 'HTTP method not allowed for this route'}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({'error': 'Internal Server Error', 'message': 'An unexpected server error occurred'}), 500

    # Ensure tables are created if using SQLite
    with app.app_context():
        db.create_all()

    return app
