from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        OPERATOR = 'OPERATOR', 'Operator'
        SUPERVISOR = 'SUPERVISOR', 'Supervisor'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OPERATOR)

    def __str__(self):
        return f"{self.username} ({self.role})"
