from django.core.management.base import BaseCommand
from users_app.models import User

class Command(BaseCommand):
    help = 'Seeds the database with demo Operator and Supervisor users.'

    def handle(self, *args, **kwargs):
        # Create Operator
        op, created = User.objects.get_or_create(username='operator1', defaults={
            'role': 'OPERATOR',
            'is_staff': True
        })
        if created:
            op.set_password('password123')
            op.save()
            self.stdout.write(self.style.SUCCESS('Created operator1 (password: password123)'))

        # Create Supervisor
        sup, created = User.objects.get_or_create(username='supervisor1', defaults={
            'role': 'SUPERVISOR',
            'is_staff': True,
            'is_superuser': True
        })
        if created:
            sup.set_password('password123')
            sup.save()
            self.stdout.write(self.style.SUCCESS('Created supervisor1 (password: password123)'))
