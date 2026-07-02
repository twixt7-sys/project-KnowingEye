"""Generate fresh CSV seed files for local development and demos."""

import csv
import os
import uuid
from datetime import datetime, timedelta

out_dir = "seed_data"
os.makedirs(out_dir, exist_ok=True)

NOW = datetime(2026, 6, 1, 9, 0, 0)

ADMIN_ACCOUNTS = [
    ("admin", "admin@knowingeye.test", "Admin", "User", "adminpass"),
    ("examiner1", "examiner1@knowingeye.test", "Elena", "Examiner", "examiner1"),
    ("examiner2", "examiner2@knowingeye.test", "Marcus", "Proctor", "examiner2"),
    ("examiner3", "examiner3@knowingeye.test", "Priya", "Invigilator", "examiner3"),
    ("examiner4", "examiner4@knowingeye.test", "James", "Supervisor", "examiner4"),
]

EXAMINEE_FIRST_NAMES = [
    "Sam", "Alex", "Jordan", "Taylor", "Casey",
    "Riley", "Morgan", "Quinn", "Avery", "Blake",
    "Cameron", "Dakota", "Emery", "Finley", "Harper",
    "Jamie", "Kendall", "Logan", "Parker", "Reese",
]
EXAMINEE_LAST_NAMES = [
    "Student", "Learner", "Examinee", "Candidate", "Scholar",
    "Nguyen", "Patel", "Garcia", "Kim", "Johnson",
    "Williams", "Brown", "Davis", "Martinez", "Anderson",
    "Thomas", "Jackson", "White", "Harris", "Martin",
]

users = []
user_id = 1
for username, email, first_name, last_name, password in ADMIN_ACCOUNTS:
    users.append(
        {
            "id": user_id,
            "username": username,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": "ADMIN",
            "is_active": "True",
            "created_at": NOW.isoformat(sep=" "),
            "updated_at": NOW.isoformat(sep=" "),
            "raw_password": password,
        }
    )
    user_id += 1

for idx in range(20):
    num = idx + 1
    users.append(
        {
            "id": user_id,
            "username": f"examinee{num:02d}",
            "email": f"examinee{num:02d}@knowingeye.test",
            "first_name": EXAMINEE_FIRST_NAMES[idx],
            "last_name": EXAMINEE_LAST_NAMES[idx],
            "role": "EXAMINEE",
            "is_active": "True",
            "created_at": NOW.isoformat(sep=" "),
            "updated_at": NOW.isoformat(sep=" "),
            "raw_password": f"pass{num:03d}",
        }
    )
    user_id += 1

departments = [
    {"id": 1, "name": "Institute of Information Technology", "abbreviation": "IIT", "is_active": "1", "sort_order": "1"},
    {"id": 2, "name": "College of Engineering", "abbreviation": "COE", "is_active": "1", "sort_order": "2"},
    {"id": 3, "name": "College of Business Administration", "abbreviation": "CBA", "is_active": "1", "sort_order": "3"},
]

EXAM_BLUEPRINTS = [
    {
        "id": 1,
        "title": "Proctoring Demo Exam",
        "description": "End-to-end demo for camera setup, identity enrollment, and monitored exam taking.",
        "instructions": "Complete proctoring setup before starting. Keep your face and upper body visible.",
        "duration_minutes": 45,
        "passing_score": 60,
        "status": "active",
        "department_id": 1,
        "exam_code": "IIT-2026-A",
        "monitoring_enabled": "True",
        "questions": [
            ("multiple_choice", "Which device is required for this proctored exam?", ["Webcam only", "Microphone only", "Webcam and microphone", "No devices"], "Webcam and microphone"),
            ("true_false", "You may leave the camera view briefly without triggering an alert.", ["True", "False"], "False"),
            ("multiple_choice", "When does the exam timer start?", ["When you open the dashboard", "After proctoring setup is complete", "When you enroll your identity", "Immediately after login"], "After proctoring setup is complete"),
            ("short_answer", "In one sentence, explain why academic integrity matters during online exams.", [], "Honest work ensures fair assessment for all students."),
            ("true_false", "Identity enrollment captures a reference photo for comparison during the exam.", ["True", "False"], "True"),
            ("multiple_choice", "What should you do if your camera disconnects?", ["Continue silently", "Refresh the page and re-allow camera access", "Submit immediately", "Switch to another browser tab"], "Refresh the page and re-allow camera access"),
            ("essay", "Describe how you prepared your workspace for a proctored exam (lighting, background, desk).", [], "Clear desk, good lighting, neutral background."),
            ("multiple_choice", "Which metric tracks whether your head is facing the camera?", ["Face presence", "Identity match", "Head facing camera", "Object clear"], "Head facing camera"),
            ("true_false", "Prohibited objects such as phones may trigger monitoring alerts.", ["True", "False"], "True"),
            ("short_answer", "Name one behavior that could lower your posture compliance score.", [], "Slouching or leaving the upper body out of frame."),
        ],
    },
    {
        "id": 2,
        "title": "Computer Science Fundamentals",
        "description": "Core concepts in algorithms, data structures, and software design.",
        "instructions": "Select the best answer for each question. Short answers should be concise.",
        "duration_minutes": 30,
        "passing_score": 70,
        "status": "active",
        "department_id": 1,
        "exam_code": "IIT-2026-B",
        "monitoring_enabled": "True",
        "questions": [
            ("multiple_choice", "What is the time complexity of binary search on a sorted array?", ["O(n)", "O(log n)", "O(n log n)", "O(1)"], "O(log n)"),
            ("true_false", "A stack follows FIFO ordering.", ["True", "False"], "False"),
            ("multiple_choice", "Which structure uses key-value pairs with average O(1) lookup?", ["Array", "Linked list", "Hash table", "Binary tree"], "Hash table"),
            ("short_answer", "What does API stand for?", [], "Application Programming Interface"),
            ("multiple_choice", "Which language runs in the browser natively?", ["Python", "JavaScript", "C++", "SQL"], "JavaScript"),
            ("essay", "Explain the difference between compiled and interpreted languages.", [], "Compiled translates ahead of time; interpreted executes line by line."),
            ("true_false", "Git is a distributed version control system.", ["True", "False"], "True"),
            ("multiple_choice", "Which HTTP method is idempotent?", ["POST", "PATCH", "PUT", "DELETE"], "PUT"),
        ],
    },
    {
        "id": 3,
        "title": "Academic Integrity Quiz",
        "description": "Policies and best practices for honest assessment.",
        "instructions": "Answer all questions. There are no trick questions.",
        "duration_minutes": 20,
        "passing_score": 80,
        "status": "active",
        "department_id": 2,
        "exam_code": "COE-2026-A",
        "monitoring_enabled": "False",
        "questions": [
            ("true_false", "Sharing exam questions with classmates during an active session is allowed.", ["True", "False"], "False"),
            ("multiple_choice", "What is plagiarism?", ["Using your own notes", "Presenting others' work as your own", "Studying in a group before the exam", "Asking the instructor for clarification"], "Presenting others' work as your own"),
            ("short_answer", "What should you do if you witness cheating?", [], "Report it to the instructor or proctor."),
            ("true_false", "Open-book exams allow unrestricted internet use unless stated otherwise.", ["True", "False"], "False"),
            ("multiple_choice", "Collaboration is permitted when:", ["Always", "Never", "Only when explicitly allowed by the instructor", "When answers are hard"], "Only when explicitly allowed by the instructor"),
        ],
    },
    {
        "id": 4,
        "title": "Mathematics Placement",
        "description": "Algebra and basic calculus readiness check.",
        "instructions": "Show work mentally; enter final answers only for numeric items.",
        "duration_minutes": 40,
        "passing_score": 65,
        "status": "active",
        "department_id": 2,
        "exam_code": "COE-2026-B",
        "monitoring_enabled": "True",
        "questions": [
            ("multiple_choice", "What is the derivative of x²?", ["x", "2x", "x²", "2"], "2x"),
            ("multiple_choice", "Solve for x: 2x + 6 = 14", ["2", "4", "6", "8"], "4"),
            ("true_false", "The slope of a horizontal line is zero.", ["True", "False"], "True"),
            ("short_answer", "What is the value of π rounded to two decimal places?", [], "3.14"),
            ("multiple_choice", "Which is equivalent to 3/4?", ["0.25", "0.5", "0.75", "1.25"], "0.75"),
            ("essay", "Explain how you would verify a solution to a linear equation.", [], "Substitute the value back into the original equation."),
        ],
    },
    {
        "id": 5,
        "title": "Draft: Advanced Monitoring (not published)",
        "description": "Work-in-progress exam for internal testing.",
        "instructions": "This exam is not available to students.",
        "duration_minutes": 60,
        "passing_score": 70,
        "status": "draft",
        "department_id": 3,
        "exam_code": "CBA-2026-A",
        "monitoring_enabled": "True",
        "questions": [
            ("multiple_choice", "Placeholder question for draft exam.", ["A", "B", "C", "D"], "A"),
        ],
    },
]

exams = []
questions = []
question_id = 1

for blueprint in EXAM_BLUEPRINTS:
    qcount = len(blueprint["questions"])
    exams.append(
        {
            "id": blueprint["id"],
            "title": blueprint["title"],
            "description": blueprint["description"],
            "instructions": blueprint["instructions"],
            "duration_minutes": blueprint["duration_minutes"],
            "total_questions": qcount,
            "passing_score": blueprint["passing_score"],
            "status": blueprint["status"],
            "department_id": blueprint["department_id"],
            "exam_code": blueprint["exam_code"],
            "monitoring_enabled": blueprint["monitoring_enabled"],
            "created_by_id": 1,
            "created_at": (NOW + timedelta(days=blueprint["id"])).isoformat(sep=" "),
            "updated_at": (NOW + timedelta(days=blueprint["id"], hours=1)).isoformat(sep=" "),
        }
    )
    for order, (qtype, text, opts, correct) in enumerate(blueprint["questions"], start=1):
        questions.append(
            {
                "id": question_id,
                "exam_id": blueprint["id"],
                "question_text": text,
                "question_type": qtype,
                "options": str(opts),
                "correct_answer": correct,
                "points": 2 if qtype == "essay" else 1,
                "order": order,
                "created_at": (NOW + timedelta(days=blueprint["id"], minutes=order)).isoformat(sep=" "),
                "updated_at": (NOW + timedelta(days=blueprint["id"], minutes=order + 1)).isoformat(sep=" "),
            }
        )
        question_id += 1

# One completed sample session for reporting demos (examinee03 = user id 8).
completed_session_id = str(uuid.uuid4())
sample_examinee_id = 8
sessions = [
    {
        "id": completed_session_id,
        "exam_id": 3,
        "user_id": sample_examinee_id,
        "started_at": (NOW + timedelta(days=10)).isoformat(sep=" "),
        "submitted_at": (NOW + timedelta(days=10, minutes=18)).isoformat(sep=" "),
        "time_remaining": 120,
        "status": "completed",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (demo)",
        "total_score": 4,
        "percentage_score": 80.0,
        "passed": "True",
    },
]

responses = []
resp_id = 1
exam3_questions = [q for q in questions if q["exam_id"] == 3]
for q in exam3_questions:
    responses.append(
        {
            "id": resp_id,
            "session_id": completed_session_id,
            "question_id": q["id"],
            "answer_text": q["correct_answer"],
            "is_correct": "True",
            "time_spent": 45,
            "answered_at": (NOW + timedelta(days=10, minutes=5)).isoformat(sep=" "),
            "flagged_for_review": "False",
        }
    )
    resp_id += 1

csv_definitions = [
    (
        "users.csv",
        ["id", "username", "email", "first_name", "last_name", "role", "is_active", "created_at", "updated_at", "raw_password"],
        users,
    ),
    (
        "departments.csv",
        ["id", "name", "abbreviation", "is_active", "sort_order"],
        departments,
    ),
    (
        "exams.csv",
        [
            "id", "title", "description", "instructions", "duration_minutes", "total_questions",
            "passing_score", "status", "department_id", "exam_code", "monitoring_enabled",
            "created_by_id", "created_at", "updated_at",
        ],
        exams,
    ),
    (
        "questions.csv",
        ["id", "exam_id", "question_text", "question_type", "options", "correct_answer", "points", "order", "created_at", "updated_at"],
        questions,
    ),
    (
        "exam_sessions.csv",
        ["id", "exam_id", "user_id", "started_at", "submitted_at", "time_remaining", "status", "ip_address", "user_agent", "total_score", "percentage_score", "passed"],
        sessions,
    ),
    (
        "responses.csv",
        ["id", "session_id", "question_id", "answer_text", "is_correct", "time_spent", "answered_at", "flagged_for_review"],
        responses,
    ),
]

for fname, headers, rows in csv_definitions:
    with open(os.path.join(out_dir, fname), "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

print(
    f"Generated {len(users)} users ({len(ADMIN_ACCOUNTS)} admin, 20 examinee), "
    f"{len(departments)} departments, {len(exams)} exams, {len(questions)} questions in {out_dir}/"
)
print("Demo logins: admin / adminpass  |  examinee01 / pass001  |  examiner1 / examiner1")
