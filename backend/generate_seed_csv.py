import csv
import os
import random
import uuid
from datetime import datetime, timedelta

out_dir = 'seed_data'
os.makedirs(out_dir, exist_ok=True)

users = []
for i in range(1, 41):
    if i == 1:
        uname = 'admin'
        role = 'ADMIN'
        email = 'admin@example.com'
        first_name = 'Admin'
        last_name = 'User'
        password = 'adminpass'
    else:
        uname = f'user{i:02d}'
        role = 'EXAMINEE'
        email = f'user{i:02d}@example.com'
        first_name = f'User{i:02d}'
        last_name = 'Test'
        password = f'pass{i:03d}'
    users.append({
        'id': i,
        'username': uname,
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
        'role': role,
        'is_active': 'True',
        'created_at': (datetime(2025, 1, 1) + timedelta(days=i)).isoformat(sep=' '),
        'updated_at': (datetime(2025, 1, 2) + timedelta(days=i)).isoformat(sep=' '),
        'raw_password': password,
    })

exam_titles = [
    'Vision Integrity Assessment', 'Proctoring Awareness Test', 'Learning Behavior Check',
    'Monitoring Security Quiz', 'Exam Ethics Evaluation', 'Adaptive Reasoning Exam',
    'Session Readiness Calibration', 'AI Proctoring Validation', 'Exam Setup Survey',
    'Rule Compliance Assessment', 'Performance Metrics Test', 'Secure Exam Practice',
    'User Experience Audit', 'Test Environment Review', 'Probity Standards Quiz',
    'Academic Honesty Survey', 'Alert Handling Challenge', 'Response Accuracy Exam',
    'Timing Strategy Test', 'Focus Monitoring Assessment', 'Behavior Pattern Survey',
    'Test Session Diagnostics', 'Camera Awareness Quiz', 'Identity Verification Exam',
    'Exam Flow Optimization', 'Question Quality Review', 'Security Protocols Assessment',
    'Proctoring Policy Exam', 'Engagement Analytics Quiz', 'Reporting Accuracy Test',
    'Exam Delivery Validation'
]
exams = []
for idx, title in enumerate(exam_titles, start=1):
    creator_id = 1 if idx <= 10 else random.randint(2, 12)
    duration = random.choice([15, 20, 30, 45, 60, 90])
    passing = random.choice([50, 60, 65, 70, 75, 80])
    exams.append({
        'id': idx,
        'title': title,
        'description': f'This exam covers {title.lower()} topics and expected workflows.',
        'instructions': 'Review each question carefully and submit when complete.',
        'duration_minutes': duration,
        'total_questions': 0,
        'passing_score': passing,
        'status': random.choice(['active', 'draft', 'archived']),
        'created_by_id': creator_id,
        'created_at': (datetime(2025, 2, 1) + timedelta(days=idx)).isoformat(sep=' '),
        'updated_at': (datetime(2025, 2, 2) + timedelta(days=idx)).isoformat(sep=' '),
    })

question_types = ['multiple_choice', 'true_false', 'short_answer', 'essay']
option_sets = [
    ['Yes', 'No'],
    ['True', 'False'],
    ['Red', 'Blue', 'Green', 'Yellow'],
    ['A', 'B', 'C', 'D']
]
questions = []
question_id = 1
for exam in exams:
    qcount = random.randint(8, 12)
    for order in range(1, qcount + 1):
        qtype = random.choices(question_types, weights=[40, 20, 25, 15])[0]
        if qtype == 'multiple_choice':
            opts = random.choice(option_sets)
            correct = opts[0]
        elif qtype == 'true_false':
            opts = ['True', 'False']
            correct = random.choice(opts)
        else:
            opts = []
            correct = 'Sample answer text'
        questions.append({
            'id': question_id,
            'exam_id': exam['id'],
            'question_text': f'Question {order} for exam {exam["id"]}: sample prompt text.',
            'question_type': qtype,
            'options': f'{opts}' if opts else '[]',
            'correct_answer': correct,
            'points': random.choice([1, 2, 3]),
            'order': order,
            'created_at': (datetime(2025, 2, 2) + timedelta(days=exam['id'], minutes=order)).isoformat(sep=' '),
            'updated_at': (datetime(2025, 2, 3) + timedelta(days=exam['id'], minutes=order)).isoformat(sep=' '),
        })
        question_id += 1

exam_counts = {}
for q in questions:
    exam_counts[q['exam_id']] = exam_counts.get(q['exam_id'], 0) + 1
for exam in exams:
    exam['total_questions'] = exam_counts.get(exam['id'], 0)

sessions = []
for i in range(1, 151):
    exam = random.choice(exams)
    user_id = random.randint(2, 40)
    started = datetime(2025, 3, 1) + timedelta(days=(i // 5), minutes=i * 3)
    status = random.choices(['completed', 'in_progress', 'terminated', 'expired'], weights=[60, 25, 10, 5])[0]
    submitted = started + timedelta(minutes=random.randint(10, exam['duration_minutes'])) if status == 'completed' else ''
    remaining = 0 if status == 'completed' else max(0, exam['duration_minutes'] * 60 - random.randint(1, exam['duration_minutes'] * 60))
    total_score = random.randint(0, exam['total_questions'] * 3) if status == 'completed' else ''
    perc = round((total_score / max(1, exam['total_questions'] * 3)) * 100, 2) if status == 'completed' else ''
    passed = 'True' if status == 'completed' and perc >= exam['passing_score'] else ('False' if status == 'completed' else '')
    sid = str(uuid.uuid4())
    sessions.append({
        'id': sid,
        'exam_id': exam['id'],
        'user_id': user_id,
        'started_at': started.isoformat(sep=' '),
        'submitted_at': submitted.isoformat(sep=' ') if submitted else '',
        'time_remaining': remaining,
        'status': status,
        'ip_address': f'192.168.{random.randint(0, 255)}.{random.randint(1, 254)}',
        'user_agent': random.choice(['Mozilla/5.0', 'Chrome/108.0', 'Safari/605.1.15', 'Edge/104.0']),
        'total_score': total_score if status == 'completed' else '',
        'percentage_score': perc if status == 'completed' else '',
        'passed': passed,
    })

responses = []
resp_id = 1
for session in sessions:
    related_questions = [q for q in questions if q['exam_id'] == session['exam_id']]
    for question in related_questions:
        if session['status'] == 'completed':
            if question['question_type'] in ['multiple_choice', 'true_false']:
                answer = question['correct_answer'] if random.random() < 0.85 else 'Incorrect answer'
                correct = 'True' if answer.strip().lower() == question['correct_answer'].strip().lower() else 'False'
            else:
                answer = 'Sample response text' if random.random() < 0.75 else 'Different answer'
                correct = 'False'
            flagged = 'True' if question['question_type'] in ['short_answer', 'essay'] else 'False'
        else:
            answer = ''
            correct = 'False'
            flagged = 'False'
        responses.append({
            'id': resp_id,
            'session_id': session['id'],
            'question_id': question['id'],
            'answer_text': answer,
            'is_correct': correct,
            'time_spent': random.randint(5, 120),
            'answered_at': (datetime.fromisoformat(session['started_at']) + timedelta(seconds=random.randint(10, 300))).isoformat(sep=' '),
            'flagged_for_review': flagged,
        })
        resp_id += 1

csv_definitions = [
    ('users.csv', ['id','username','email','first_name','last_name','role','is_active','created_at','updated_at','raw_password'], users),
    ('exams.csv', ['id','title','description','instructions','duration_minutes','total_questions','passing_score','status','created_by_id','created_at','updated_at'], exams),
    ('questions.csv', ['id','exam_id','question_text','question_type','options','correct_answer','points','order','created_at','updated_at'], questions),
    ('exam_sessions.csv', ['id','exam_id','user_id','started_at','submitted_at','time_remaining','status','ip_address','user_agent','total_score','percentage_score','passed'], sessions),
    ('responses.csv', ['id','session_id','question_id','answer_text','is_correct','time_spent','answered_at','flagged_for_review'], responses),
]
for fname, headers, rows in csv_definitions:
    with open(os.path.join(out_dir, fname), 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
print('Generated CSV seed files in', out_dir)
