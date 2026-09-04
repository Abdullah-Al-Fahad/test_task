from django.contrib import admin
from .models import ServiceRequest

@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer_account', 'request_type', 'status', 'progress', 'operator', 'created_at']
    list_filter = ['status', 'request_type', 'operator']
    search_fields = ['customer_account', 'operator__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
