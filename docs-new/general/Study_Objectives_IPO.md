# Objectives of the Study (IPO Format)

**Knowing Eye: A Web-Based Examination Platform with Behavior Monitoring Using Facial and Postural Analysis**

---

## General Objective

**Objective:** To develop Knowing Eye: A Web-Based Examination Platform with Behavior Monitoring Using Facial and Postural Analysis to enhance examination integrity, monitoring efficiency, and assessment reliability.

| | |
|---|---|
| **Input** | Examination requirements from Legacy College of Compostela; web development technologies; computer vision and deep learning tools (YOLO, CNN, FaceNet or ArcFace); webcam video streams from examinees; publicly available datasets and controlled mock-examination recordings; Agile software development methodology |
| **Process** | Plan, design, develop, integrate, test, and deploy a unified web-based examination platform that performs real-time facial and postural behavior monitoring during exam sessions |
| **Output** | A fully developed Knowing Eye platform that supports centralized exam management and automated behavior monitoring, resulting in improved examination integrity, monitoring efficiency, and assessment reliability |

---

## Specific Objectives

### 1. Centralized Web-Based Examination Platform

**Objective:** Develop a centralized web-based examination platform capable of managing exam creation, administration, and monitoring within a unified system.

| | |
|---|---|
| **Input** | Exam content and configuration requirements; user roles (administrators, proctors, and examinees); web frameworks, database systems, and related development tools |
| **Process** | Design and implement integrated modules for exam creation, scheduling, administration, and monitoring within a single web-based platform |
| **Output** | A centralized web-based examination platform that handles the full examination workflow in one unified system |

---

### 2. Monitoring and Data Management System

**Objective:** Develop a monitoring and data management system that captures and stores examination-related data.

| | |
|---|---|
| **Input** | Webcam video streams during examination sessions; examinee interaction records; system-generated logs and session events |
| **Process** | Capture, organize, store, and manage examination-related data including video feeds, behavioral logs, and session records |
| **Output** | A monitoring and data management system with properly stored and retrievable examination data for review and analysis |

---

### 3. Real-Time Computer Vision for Behavior Analysis

**Objective:** Apply computer vision techniques to analyze examinee behavior in real time.

| | |
|---|---|
| **Input** | Live webcam video feeds; computer vision libraries and algorithms; trained detection and tracking models |
| **Process** | Process video frames in real time to detect, track, and analyze examinee behavior throughout the examination session |
| **Output** | Continuous real-time behavioral analysis results used to support examination monitoring |

**3.1 Detect facial presence and identity consistency**

| | |
|---|---|
| **Input** | Live facial video frames; enrolled reference identity data |
| **Process** | Detect whether a face is present in the video feed and verify that the examinee's identity remains consistent throughout the session |
| **Output** | Facial presence status and identity consistency verification results |

**3.2 Track head movement, eye gaze, and posture**

| | |
|---|---|
| **Input** | Video frames; head pose, gaze estimation, and posture detection models |
| **Process** | Continuously track head orientation, eye gaze direction, and body posture during the examination |
| **Output** | Recorded behavioral tracking data for head movement, eye gaze, and posture |

**3.3 Identify abnormal or suspicious behavioral patterns**

| | |
|---|---|
| **Input** | Tracked behavioral data; predefined thresholds and rules for normal versus suspicious behavior |
| **Process** | Compare observed behavior against expected patterns and identify actions that may indicate irregular or suspicious conduct |
| **Output** | Identified abnormal or suspicious behavioral patterns flagged for further review |

---

### 4. Deep Learning Integration for Behavioral Analysis

**Objective:** Integrate deep learning algorithms for behavioral analysis.

| | |
|---|---|
| **Input** | Training datasets (publicly available and controlled mock-examination recordings); YOLO, CNN, and FaceNet or ArcFace model architectures |
| **Process** | Integrate and configure deep learning models for detection, feature extraction, and facial verification within the monitoring pipeline |
| **Output** | An AI-powered behavioral analysis pipeline capable of automated face detection, feature extraction, and identity verification |

**4.1 Utilize YOLO for face and posture detection**

| | |
|---|---|
| **Input** | Video frames; pre-trained or fine-tuned YOLO model weights |
| **Process** | Apply YOLO-based object detection to identify faces and body postures in each video frame |
| **Output** | Detected face and posture locations with corresponding bounding box coordinates |

**4.2 Apply convolutional neural networks (CNN) for feature extraction**

| | |
|---|---|
| **Input** | Detected facial and postural regions from video frames; CNN architecture |
| **Process** | Extract meaningful visual features from detected regions using convolutional neural networks |
| **Output** | Feature vectors ready for behavioral classification and identity verification |

**4.3 Implement FaceNet or ArcFace for facial feature consistency verification**

| | |
|---|---|
| **Input** | Extracted facial features; enrolled reference facial embeddings |
| **Process** | Compare facial embeddings across the session using FaceNet or ArcFace to verify identity consistency |
| **Output** | Facial verification results indicating whether the examinee's identity matches the enrolled reference |

---

### 5. Behavior Monitoring and Scoring Module

**Objective:** Develop a behavior monitoring and scoring module.

| | |
|---|---|
| **Input** | Real-time behavioral analysis results; anomaly detection rules; examination session context |
| **Process** | Process detected behaviors, assign indicators, flag anomalies, and log events throughout the examination session |
| **Output** | A behavior monitoring and scoring module that supports automated anomaly detection and behavioral reporting |

**5.1 Flag potential anomalies during examination sessions**

| | |
|---|---|
| **Input** | Detected suspicious behavioral patterns; session timestamps and event logs |
| **Process** | Automatically flag behaviors that exceed defined anomaly criteria during live examination sessions |
| **Output** | Real-time anomaly flags with corresponding timestamps and session references |

**5.2 Generate behavioral indicators based on detected patterns**

| | |
|---|---|
| **Input** | Flagged events and accumulated behavioral tracking data |
| **Process** | Compile and compute behavioral indicators from detected patterns across the examination session |
| **Output** | Behavioral indicator reports summarizing examinee conduct during the session |

**5.3 Support review of flagged events by administrators**

| | |
|---|---|
| **Input** | Flagged events; recorded evidence including logs, timestamps, and session details |
| **Process** | Present flagged events in a structured format that allows administrators to review and assess each incident |
| **Output** | Reviewable flagged-event records that support informed administrator judgment |

---

### 6. Administrative Dashboard

**Objective:** Generate an administrative dashboard that visualizes examination data and monitoring results.

| | |
|---|---|
| **Input** | Examination records; monitoring results; behavioral reports; session logs |
| **Process** | Design and implement a dashboard with data visualization components that organize and present monitoring information |
| **Output** | An administrative dashboard for reviewing sessions, analyzing reports, and supporting examination integrity decisions |

**6.1 Review examination sessions**

| | |
|---|---|
| **Input** | Session logs; exam metadata; monitoring recordings and activity records |
| **Process** | Display session summaries and detailed records within the dashboard interface |
| **Output** | A session review interface that allows administrators to inspect individual examination sessions |

**6.2 Analyze behavioral reports**

| | |
|---|---|
| **Input** | Behavioral indicators; anomaly flags; historical monitoring data |
| **Process** | Visualize and organize behavioral data into readable reports and charts for analysis |
| **Output** | Interactive behavioral report views that help administrators understand examinee conduct patterns |

**6.3 Support decision-making regarding examination integrity**

| | |
|---|---|
| **Input** | Aggregated monitoring results; flagged events; behavioral trends across sessions |
| **Process** | Present consolidated integrity-related insights and summaries to guide administrator review |
| **Output** | Decision-support information for administrators; final judgment on examination integrity remains at administrator discretion |

---

### 7. System Evaluation

**Objective:** Evaluate the functionality, usability, and effectiveness of the developed platform in improving examination monitoring efficiency and supporting fair and reliable assessment processes.

| | |
|---|---|
| **Input** | The developed Knowing Eye platform; evaluation criteria covering functionality, usability, and effectiveness; test participants and mock examination scenarios at Legacy College of Compostela |
| **Process** | Conduct systematic testing and evaluation using appropriate methods to measure how well the platform performs its intended functions and how usable it is for end users |
| **Output** | Documented evaluation results demonstrating the platform's functionality, usability, and effectiveness in improving monitoring efficiency and supporting fair, reliable assessment processes |

---

## Plain-Text Version (for direct copy-paste into Word)

Use the block below if you prefer a single flowing section without markdown tables.

---

GENERAL OBJECTIVE

Objective: To develop Knowing Eye: A Web-Based Examination Platform with Behavior Monitoring Using Facial and Postural Analysis to enhance examination integrity, monitoring efficiency, and assessment reliability.

Input: Examination requirements from Legacy College of Compostela; web development technologies; computer vision and deep learning tools (YOLO, CNN, FaceNet or ArcFace); webcam video streams from examinees; publicly available datasets and controlled mock-examination recordings; Agile software development methodology.

Process: Plan, design, develop, integrate, test, and deploy a unified web-based examination platform that performs real-time facial and postural behavior monitoring during exam sessions.

Output: A fully developed Knowing Eye platform that supports centralized exam management and automated behavior monitoring, resulting in improved examination integrity, monitoring efficiency, and assessment reliability.


SPECIFIC OBJECTIVE 1

Objective: Develop a centralized web-based examination platform capable of managing exam creation, administration, and monitoring within a unified system.

Input: Exam content and configuration requirements; user roles (administrators, proctors, and examinees); web frameworks, database systems, and related development tools.

Process: Design and implement integrated modules for exam creation, scheduling, administration, and monitoring within a single web-based platform.

Output: A centralized web-based examination platform that handles the full examination workflow in one unified system.


SPECIFIC OBJECTIVE 2

Objective: Develop a monitoring and data management system that captures and stores examination-related data.

Input: Webcam video streams during examination sessions; examinee interaction records; system-generated logs and session events.

Process: Capture, organize, store, and manage examination-related data including video feeds, behavioral logs, and session records.

Output: A monitoring and data management system with properly stored and retrievable examination data for review and analysis.


SPECIFIC OBJECTIVE 3

Objective: Apply computer vision techniques to analyze examinee behavior in real time.

Input: Live webcam video feeds; computer vision libraries and algorithms; trained detection and tracking models.

Process: Process video frames in real time to detect, track, and analyze examinee behavior throughout the examination session.

Output: Continuous real-time behavioral analysis results used to support examination monitoring.

3.1 Detect facial presence and identity consistency
Input: Live facial video frames; enrolled reference identity data.
Process: Detect whether a face is present in the video feed and verify that the examinee's identity remains consistent throughout the session.
Output: Facial presence status and identity consistency verification results.

3.2 Track head movement, eye gaze, and posture
Input: Video frames; head pose, gaze estimation, and posture detection models.
Process: Continuously track head orientation, eye gaze direction, and body posture during the examination.
Output: Recorded behavioral tracking data for head movement, eye gaze, and posture.

3.3 Identify abnormal or suspicious behavioral patterns
Input: Tracked behavioral data; predefined thresholds and rules for normal versus suspicious behavior.
Process: Compare observed behavior against expected patterns and identify actions that may indicate irregular or suspicious conduct.
Output: Identified abnormal or suspicious behavioral patterns flagged for further review.


SPECIFIC OBJECTIVE 4

Objective: Integrate deep learning algorithms for behavioral analysis.

Input: Training datasets (publicly available and controlled mock-examination recordings); YOLO, CNN, and FaceNet or ArcFace model architectures.

Process: Integrate and configure deep learning models for detection, feature extraction, and facial verification within the monitoring pipeline.

Output: An AI-powered behavioral analysis pipeline capable of automated face detection, feature extraction, and identity verification.

4.1 Utilize YOLO for face and posture detection
Input: Video frames; pre-trained or fine-tuned YOLO model weights.
Process: Apply YOLO-based object detection to identify faces and body postures in each video frame.
Output: Detected face and posture locations with corresponding bounding box coordinates.

4.2 Apply convolutional neural networks (CNN) for feature extraction
Input: Detected facial and postural regions from video frames; CNN architecture.
Process: Extract meaningful visual features from detected regions using convolutional neural networks.
Output: Feature vectors ready for behavioral classification and identity verification.

4.3 Implement FaceNet or ArcFace for facial feature consistency verification
Input: Extracted facial features; enrolled reference facial embeddings.
Process: Compare facial embeddings across the session using FaceNet or ArcFace to verify identity consistency.
Output: Facial verification results indicating whether the examinee's identity matches the enrolled reference.


SPECIFIC OBJECTIVE 5

Objective: Develop a behavior monitoring and scoring module.

Input: Real-time behavioral analysis results; anomaly detection rules; examination session context.

Process: Process detected behaviors, assign indicators, flag anomalies, and log events throughout the examination session.

Output: A behavior monitoring and scoring module that supports automated anomaly detection and behavioral reporting.

5.1 Flag potential anomalies during examination sessions
Input: Detected suspicious behavioral patterns; session timestamps and event logs.
Process: Automatically flag behaviors that exceed defined anomaly criteria during live examination sessions.
Output: Real-time anomaly flags with corresponding timestamps and session references.

5.2 Generate behavioral indicators based on detected patterns
Input: Flagged events and accumulated behavioral tracking data.
Process: Compile and compute behavioral indicators from detected patterns across the examination session.
Output: Behavioral indicator reports summarizing examinee conduct during the session.

5.3 Support review of flagged events by administrators
Input: Flagged events; recorded evidence including logs, timestamps, and session details.
Process: Present flagged events in a structured format that allows administrators to review and assess each incident.
Output: Reviewable flagged-event records that support informed administrator judgment.


SPECIFIC OBJECTIVE 6

Objective: Generate an administrative dashboard that visualizes examination data and monitoring results.

Input: Examination records; monitoring results; behavioral reports; session logs.

Process: Design and implement a dashboard with data visualization components that organize and present monitoring information.

Output: An administrative dashboard for reviewing sessions, analyzing reports, and supporting examination integrity decisions.

6.1 Review examination sessions
Input: Session logs; exam metadata; monitoring recordings and activity records.
Process: Display session summaries and detailed records within the dashboard interface.
Output: A session review interface that allows administrators to inspect individual examination sessions.

6.2 Analyze behavioral reports
Input: Behavioral indicators; anomaly flags; historical monitoring data.
Process: Visualize and organize behavioral data into readable reports and charts for analysis.
Output: Interactive behavioral report views that help administrators understand examinee conduct patterns.

6.3 Support decision-making regarding examination integrity
Input: Aggregated monitoring results; flagged events; behavioral trends across sessions.
Process: Present consolidated integrity-related insights and summaries to guide administrator review.
Output: Decision-support information for administrators; final judgment on examination integrity remains at administrator discretion.


SPECIFIC OBJECTIVE 7

Objective: Evaluate the functionality, usability, and effectiveness of the developed platform in improving examination monitoring efficiency and supporting fair and reliable assessment processes.

Input: The developed Knowing Eye platform; evaluation criteria covering functionality, usability, and effectiveness; test participants and mock examination scenarios at Legacy College of Compostela.

Process: Conduct systematic testing and evaluation using appropriate methods to measure how well the platform performs its intended functions and how usable it is for end users.

Output: Documented evaluation results demonstrating the platform's functionality, usability, and effectiveness in improving monitoring efficiency and supporting fair, reliable assessment processes.
