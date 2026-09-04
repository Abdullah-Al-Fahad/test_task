import time
import logging

from celery import shared_task
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import ServiceRequest

logger = logging.getLogger(__name__)


def _broadcast_update(channel_layer, req: ServiceRequest, log_message: str = None) -> None:
    """
    Publishes a status update event to the Redis channel layer.
    """
    payload = {
        "id": str(req.id),
        "customer_account": req.customer_account,
        "request_type": req.request_type,
        "status": req.status,
        "progress": req.progress,
        "operator_username": req.operator.username if req.operator_id else None,
    }
    if log_message:
        payload["log_message"] = log_message

    async_to_sync(channel_layer.group_send)(
        "requests_updates",
        {
            "type": "request_update",
            "message": payload,
        },
    )


def _mark_failed(req: ServiceRequest, channel_layer, reason: str = "Unknown error occurred.") -> None:
    req.status = ServiceRequest.Status.FAILED
    req.save(update_fields=["status", "updated_at"])
    _broadcast_update(channel_layer, req, log_message=f"[ERROR] Task failed: {reason}")


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    acks_late=True,
)
def process_service_request(self, request_id: str) -> str:
    logger.info("Starting task for request_id=%s", request_id)

    try:
        req = ServiceRequest.objects.select_related("operator").get(id=request_id)
    except ServiceRequest.DoesNotExist:
        logger.error("ServiceRequest %s not found. Discarding task.", request_id)
        return request_id

    channel_layer = get_channel_layer()

    def _log_and_progress(msg: str, progress: int):
        req.progress = progress
        req.save(update_fields=["progress", "updated_at"])
        _broadcast_update(channel_layer, req, log_message=msg)
        time.sleep(1.5)  # Simulate network/IO delay

    try:
        req.status = ServiceRequest.Status.PROCESSING
        req.progress = 5
        req.save(update_fields=["status", "progress", "updated_at"])
        _broadcast_update(channel_layer, req, log_message=f"[START] Initializing {req.get_request_type_display()} for {req.customer_account}...")
        time.sleep(1)

        # Dynamic workflows based on ISP Request Type
        if req.request_type == ServiceRequest.RequestType.LINE_DIAGNOSTIC:
            _log_and_progress("[INFO] Pinging customer modem (ICMP echo)...", 20)
            _log_and_progress("[INFO] Analyzing packet loss and latency metrics...", 40)
            _log_and_progress("[INFO] Checking upstream/downstream SNR levels...", 60)
            _log_and_progress("[INFO] Running DOCSIS channel bonding verification...", 80)
            _log_and_progress("[SUCCESS] Line diagnostic passed. Signal within normal parameters.", 100)
            
        elif req.request_type == ServiceRequest.RequestType.FIRMWARE_UPGRADE:
            _log_and_progress(f"[INFO] Connecting to customer modem for {req.customer_account}...", 20)
            _log_and_progress("[INFO] Downloading firmware payload v4.2.1 from vendor server...", 40)
            _log_and_progress("[WARN] Connection unstable. Retrying flash sequence...", 60)
            _log_and_progress("[INFO] Flash successful. Initiating remote reboot...", 80)
            _log_and_progress("[SUCCESS] Modem online. Firmware version verified.", 100)

        elif req.request_type == ServiceRequest.RequestType.NETWORK_PROVISION:
            _log_and_progress("[INFO] Validating MAC address format...", 20)
            _log_and_progress("[INFO] Allocating dynamic IP from DHCP pool...", 40)
            _log_and_progress("[INFO] Pushing configuration to local neighborhood switch...", 60)
            _log_and_progress("[INFO] Testing automated radius authentication...", 80)
            _log_and_progress("[SUCCESS] Provisioning complete. Account activated on network.", 100)
            
        else:
            _log_and_progress("[INFO] Running generic system background task...", 50)
            _log_and_progress("[SUCCESS] Task completed.", 100)

        req.status = ServiceRequest.Status.COMPLETED
        req.save(update_fields=["status", "updated_at"])
        _broadcast_update(channel_layer, req)

    except Exception as exc:
        logger.exception("Task failed for request_id=%s: %s", request_id, exc)
        max_retries = self.max_retries
        if self.request.retries >= max_retries:
            _mark_failed(req, channel_layer, reason=str(exc))
        raise

    return request_id
