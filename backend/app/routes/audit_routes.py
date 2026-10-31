from flask import Blueprint, request, jsonify
from backend.app.models.audit import AuditEvent
from backend.app.services.auth_service import jwt_required

audit_bp = Blueprint('audit', __name__, url_prefix='/api/v1/audit')

@audit_bp.route('', methods=['GET'])
@jwt_required
def get_audit_logs():
    event_type = request.args.get('event_type')
    result = request.args.get('result')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))

    query = AuditEvent.query.order_by(AuditEvent.created_at.desc())
    if event_type:
        query = query.filter_by(event_type=event_type)
    if result:
        query = query.filter_by(result=result)

    total = query.count()
    events = query.offset(offset).limit(limit).all()

    return jsonify({
        'total': total,
        'limit': limit,
        'offset': offset,
        'events': [e.to_dict() for e in events]
    }), 200


@audit_bp.route('/recent', methods=['GET'])
@jwt_required
def get_recent_audit_logs():
    events = AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(15).all()
    return jsonify({
        'events': [e.to_dict() for e in events]
    }), 200

