# Generated manually for exam system refactor

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0008_exam_shuffle_questions'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='exam',
            name='is_practice',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exam',
            name='max_tab_switches',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='exam',
            name='presentation_mode',
            field=models.CharField(
                choices=[
                    ('one_per_page', 'One question per page'),
                    ('section_per_page', 'One section per page'),
                    ('scroll_all', 'All questions on one page'),
                ],
                default='one_per_page',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='exam',
            name='requires_assignment',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exam',
            name='results_release_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='exam',
            name='show_correct_answers',
            field=models.CharField(
                choices=[
                    ('never', 'Never'),
                    ('after_release', 'After results release'),
                    ('immediately', 'Immediately after submit'),
                ],
                default='never',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='exam',
            name='shuffle_options',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='exam',
            name='unanswered_counts_as_wrong',
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name='ExamSection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('instructions', models.TextField(blank=True, default='')),
                ('order', models.PositiveIntegerField(default=0)),
                ('questions_per_page', models.PositiveIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('exam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sections', to='exams.exam')),
            ],
            options={
                'db_table': 'exams_section',
                'ordering': ['exam', 'order'],
                'unique_together': {('exam', 'order')},
            },
        ),
        migrations.CreateModel(
            name='QuestionPool',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('draw_count', models.PositiveIntegerField(default=1)),
                ('order', models.PositiveIntegerField(default=0)),
                ('exam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='question_pools', to='exams.exam')),
            ],
            options={
                'db_table': 'exams_question_pool',
                'ordering': ['exam', 'order'],
            },
        ),
        migrations.CreateModel(
            name='ExamAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('invited', 'Invited'), ('eligible', 'Eligible'), ('blocked', 'Blocked')], default='eligible', max_length=20)),
                ('access_code', models.CharField(blank=True, default='', max_length=64)),
                ('attempts_override', models.PositiveIntegerField(blank=True, null=True)),
                ('extra_time_minutes', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('exam', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='exams.exam')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exam_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'exams_assignment',
                'unique_together': {('exam', 'user')},
            },
        ),
        migrations.AddIndex(
            model_name='examassignment',
            index=models.Index(fields=['exam', 'status'], name='exams_assig_exam_id_idx'),
        ),
        migrations.AddIndex(
            model_name='examassignment',
            index=models.Index(fields=['user'], name='exams_assig_user_id_idx'),
        ),
        migrations.AddField(
            model_name='question',
            name='acceptable_answers',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='question',
            name='case_sensitive',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='question',
            name='pool',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='questions', to='exams.questionpool'),
        ),
        migrations.AddField(
            model_name='question',
            name='section',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='questions', to='exams.examsection'),
        ),
        migrations.AddField(
            model_name='question',
            name='shuffle_options_override',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='question',
            name='trim_whitespace',
            field=models.BooleanField(default=True),
        ),
    ]
