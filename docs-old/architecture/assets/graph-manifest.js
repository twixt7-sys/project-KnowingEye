window.KNOWING_EYE_GRAPHS = {
  "ai-pipeline-component.json": {
    "diagram_id": "Fig-2.3",
    "title": "AI / Computer Vision Module Architecture",
    "section": "2.1.2.3",
    "description": "Internal structure of backend/ai/knowing_eye and its integration boundary via backend/ai/adapter.py.",
    "format": "component_diagram",
    "integration_boundary": {
      "django_side": "backend/ai/adapter.py",
      "pipeline_side": "backend/ai/knowing_eye/pipeline.py",
      "config": "backend/ai/config/pipeline.yaml",
      "fallback": "StubPipeline when ML deps unavailable"
    },
    "nodes": [
      {
        "id": "adapter",
        "label": "AI Adapter",
        "path": "backend/ai/adapter.py",
        "functions": [
          "get_pipeline_mode()",
          "analyze_frame_bgr()",
          "enroll_reference()"
        ]
      },
      {
        "id": "pipeline",
        "label": "BehaviorPipeline",
        "path": "backend/ai/knowing_eye/pipeline.py",
        "role": "Orchestrator"
      },
      {
        "id": "preprocess",
        "label": "Preprocessing",
        "path": "backend/ai/knowing_eye/preprocessing/",
        "modules": [
          "frame.py"
        ]
      },
      {
        "id": "detection",
        "label": "Detection",
        "path": "backend/ai/knowing_eye/detection/",
        "modules": [
          "face_detector.py",
          "pose_detector.py",
          "yolo_detector.py",
          "mp_models.py"
        ]
      },
      {
        "id": "recognition",
        "label": "Recognition",
        "path": "backend/ai/knowing_eye/recognition/",
        "modules": [
          "identity.py",
          "arcface_backend.py"
        ]
      },
      {
        "id": "behavior",
        "label": "Behavior Analysis",
        "path": "backend/ai/knowing_eye/behavior/",
        "modules": [
          "scoring.py",
          "temporal.py",
          "normalize.py"
        ]
      },
      {
        "id": "config",
        "label": "Pipeline Config",
        "path": "backend/ai/config/pipeline.yaml",
        "role": "Thresholds, model paths, weights"
      }
    ],
    "edges": [
      {
        "from": "adapter",
        "to": "pipeline",
        "label": "lazy init (thread-safe)"
      },
      {
        "from": "pipeline",
        "to": "preprocess",
        "label": "normalize frame"
      },
      {
        "from": "pipeline",
        "to": "detection",
        "label": "face, pose, YOLO"
      },
      {
        "from": "pipeline",
        "to": "recognition",
        "label": "identity match"
      },
      {
        "from": "pipeline",
        "to": "behavior",
        "label": "score + temporal patterns"
      },
      {
        "from": "config",
        "to": "pipeline",
        "label": "load thresholds"
      }
    ],
    "models_and_libraries": [
      {
        "name": "YOLOv8n",
        "library": "ultralytics",
        "purpose": "Person and cell-phone detection",
        "config_key": "detection.yolo_model"
      },
      {
        "name": "MediaPipe Face",
        "library": "mediapipe",
        "purpose": "Face mesh and detection",
        "config_key": "detection.face_backend"
      },
      {
        "name": "MediaPipe Pose",
        "library": "mediapipe",
        "purpose": "Posture and body keypoints",
        "config_key": "detection.pose_backend"
      },
      {
        "name": "ArcFace (buffalo_l)",
        "library": "insightface/onnxruntime",
        "purpose": "Face embedding identity verification",
        "config_key": "recognition.embedding_backend"
      },
      {
        "name": "FaceNet-compatible",
        "library": "face_recognition (optional)",
        "purpose": "Legacy embedding backend",
        "config_key": "recognition.embedding_backend"
      }
    ],
    "output_schema": {
      "metrics": {
        "face_pct": "float 0\u2013100",
        "gaze_pct": "float 0\u2013100",
        "posture_pct": "float 0\u2013100",
        "identity_pct": "float 0\u2013100",
        "object_pct": "float 0\u2013100",
        "overall_compliance_pct": "float 0\u2013100"
      },
      "events": [
        "array of { type, score, confidence, metadata }"
      ],
      "alerts": [
        "array of { type, severity, message, metric_pct }"
      ]
    },
    "event_types": [
      "no_face",
      "multiple_faces",
      "looking_away",
      "bad_posture",
      "leaving_seat",
      "object_detected",
      "identity_mismatch",
      "suspicious_pattern"
    ],
    "pipeline_modes": [
      {
        "mode": "production",
        "condition": "ML deps installed, ENABLE_PIPELINE=True"
      },
      {
        "mode": "stub",
        "condition": "Import failure or missing deps"
      },
      {
        "mode": "disabled",
        "condition": "KE_ENABLE_PIPELINE=False"
      }
    ]
  },
  "backend-layers.json": {
    "diagram_id": "Fig-2.2",
    "title": "Backend Layered Architecture",
    "section": "2.2",
    "description": "Feature-based modular monolith internal structure with service-repository pattern per domain module.",
    "format": "layered_component",
    "layers": [
      {
        "name": "Core Layer",
        "path": "backend/core/",
        "responsibilities": [
          "Django settings (core/config/settings.py)",
          "ASGI/WSGI entry (core/config/asgi.py)",
          "Global URL routing",
          "Exception handlers",
          "Management commands (seed_db)",
          "Base model mixins (TimeStampedModel)"
        ]
      },
      {
        "name": "Feature Layer",
        "path": "backend/features/",
        "modules": [
          {
            "name": "authentication",
            "models": [
              "User (AbstractUser + role)"
            ],
            "api_prefix": "/api/auth/",
            "auth": "SimpleJWT"
          },
          {
            "name": "exams",
            "models": [
              "Exam",
              "Question"
            ],
            "api_prefix": "/api/exams/",
            "patterns": [
              "ViewSets",
              "nested questions",
              "publish/archive actions"
            ]
          },
          {
            "name": "session",
            "models": [
              "ExamSession (UUID PK)",
              "Response",
              "SessionLog"
            ],
            "api_prefix": "/api/sessions/",
            "patterns": [
              "start/submit/terminate",
              "auto-scoring"
            ]
          },
          {
            "name": "monitoring",
            "models": [
              "SessionIdentityReference"
            ],
            "api_prefix": "/api/monitoring/",
            "websocket": [
              "/ws/monitoring/{session_id}/",
              "/ws/monitoring/alerts/"
            ],
            "patterns": [
              "REST frame fallback",
              "AsyncJsonWebsocketConsumer"
            ]
          },
          {
            "name": "behavior",
            "models": [
              "BehaviorLog",
              "Alert"
            ],
            "api_prefix": "/api/behavior/",
            "patterns": [
              "persist_analysis service",
              "alert resolve"
            ]
          },
          {
            "name": "reports",
            "models": [],
            "api_prefix": "/api/reports/",
            "patterns": [
              "aggregations",
              "CSV export",
              "timeseries"
            ]
          }
        ]
      },
      {
        "name": "AI Integration Layer",
        "path": "backend/ai/",
        "responsibilities": [
          "adapter.py \u2014 pipeline bridge",
          "frame_utils.py \u2014 base64 decode",
          "Stub pipeline for contract testing"
        ]
      },
      {
        "name": "Shared Layer",
        "path": "backend/shared/ (planned/partial)",
        "responsibilities": [
          "Base repository classes",
          "Common DTOs and validators",
          "Reusable mixins"
        ]
      }
    ],
    "request_flow": [
      "HTTP/WS \u2192 ASGI router",
      "\u2192 DRF view / Channels consumer",
      "\u2192 Permission check (RBAC + JWT)",
      "\u2192 Service layer (business logic)",
      "\u2192 Repository / ORM (data access)",
      "\u2192 Serializer / JSON response"
    ],
    "authentication_strategy": {
      "method": "JWT (SimpleJWT)",
      "access_token_ttl": "30 min (configurable JWT_ACCESS_TTL_MIN)",
      "refresh_token_ttl": "14 days (configurable JWT_REFRESH_TTL_DAYS)",
      "websocket_auth": "JWT access token via query string ?token=",
      "roles": [
        "ADMIN",
        "EXAMINEE"
      ],
      "permissions": "DRF permission classes + consumer _user_can_access()"
    }
  },
  "data-flow-monitoring.json": {
    "diagram_id": "Fig-3.2",
    "title": "Real-Time Monitoring Data Flow",
    "section": "2.1.3.2",
    "description": "Frame capture through AI analysis, persistence, and alert broadcast to examinee and administrator clients.",
    "format": "data_flow_diagram",
    "levels": [
      {
        "level": 0,
        "name": "Context",
        "processes": [
          "Knowing Eye Monitoring System"
        ],
        "external_entities": [
          "Examinee Webcam",
          "Examinee UI",
          "Administrator Dashboard"
        ],
        "data_stores": [
          "Session DB"
        ]
      },
      {
        "level": 1,
        "processes": [
          {
            "id": "P1",
            "label": "Capture Frame",
            "component": "Browser MediaDevices API"
          },
          {
            "id": "P2",
            "label": "Encode & Stream",
            "component": "use-monitoring hook"
          },
          {
            "id": "P3",
            "label": "Receive Frame",
            "component": "MonitoringConsumer"
          },
          {
            "id": "P4",
            "label": "Decode Image",
            "component": "ai/frame_utils.py"
          },
          {
            "id": "P5",
            "label": "Run CV Pipeline",
            "component": "BehaviorPipeline"
          },
          {
            "id": "P6",
            "label": "Score & Alert",
            "component": "behavior/scoring.py"
          },
          {
            "id": "P7",
            "label": "Persist Events",
            "component": "behavior/services.py"
          },
          {
            "id": "P8",
            "label": "Broadcast Alerts",
            "component": "Channels group_send"
          }
        ],
        "data_flows": [
          {
            "from": "Examinee Webcam",
            "to": "P1",
            "data": "video stream"
          },
          {
            "from": "P1",
            "to": "P2",
            "data": "canvas JPEG snapshot"
          },
          {
            "from": "P2",
            "to": "P3",
            "data": "JSON { type: frame, image: base64 }",
            "protocol": "WebSocket"
          },
          {
            "from": "P2",
            "to": "P3",
            "data": "POST /api/monitoring/frame/",
            "protocol": "REST fallback",
            "optional": true
          },
          {
            "from": "P3",
            "to": "P4",
            "data": "raw base64 string"
          },
          {
            "from": "P4",
            "to": "P5",
            "data": "BGR numpy frame"
          },
          {
            "from": "P5",
            "to": "P6",
            "data": "detections, pose, gaze, identity match"
          },
          {
            "from": "P6",
            "to": "P7",
            "data": "analysis dict (metrics, events, alerts)"
          },
          {
            "from": "P7",
            "to": "Session DB",
            "data": "behavior_log rows, alert rows"
          },
          {
            "from": "P6",
            "to": "P3",
            "data": "analysis payload"
          },
          {
            "from": "P3",
            "to": "Examinee UI",
            "data": "{ type: analysis, payload }",
            "protocol": "WebSocket"
          },
          {
            "from": "P8",
            "to": "Administrator Dashboard",
            "data": "{ type: alert, payload }",
            "protocol": "WebSocket /ws/monitoring/alerts/"
          }
        ]
      }
    ],
    "pipeline_stages": [
      {
        "stage": 1,
        "module": "preprocessing/frame.py",
        "output": "Normalized BGR frame"
      },
      {
        "stage": 2,
        "module": "detection/face_detector.py",
        "output": "Face bounding boxes, count"
      },
      {
        "stage": 3,
        "module": "detection/pose_detector.py",
        "output": "Body keypoints, posture metrics"
      },
      {
        "stage": 4,
        "module": "detection/yolo_detector.py",
        "output": "Person/phone object detections"
      },
      {
        "stage": 5,
        "module": "recognition/identity.py",
        "output": "Embedding vs reference match"
      },
      {
        "stage": 6,
        "module": "behavior/scoring.py",
        "output": "Compliance %, weighted events"
      },
      {
        "stage": 7,
        "module": "behavior/temporal.py",
        "output": "Suspicious pattern over time window"
      }
    ],
    "performance_targets": {
      "target_fps": 5,
      "latency_target_ms": 300,
      "frame_handling_note": "Client throttles capture; server may skip frames under load"
    },
    "websocket_message_schema": {
      "client_to_server": [
        {
          "type": "frame",
          "fields": [
            "image"
          ]
        },
        {
          "type": "enroll",
          "fields": [
            "image"
          ]
        },
        {
          "type": "ping",
          "fields": []
        }
      ],
      "server_to_client": [
        {
          "type": "connected",
          "fields": [
            "session_id",
            "pipeline_mode"
          ]
        },
        {
          "type": "analysis",
          "fields": [
            "payload",
            "persisted"
          ]
        },
        {
          "type": "alert",
          "fields": [
            "payload"
          ]
        },
        {
          "type": "enroll_result",
          "fields": [
            "ok",
            "message?"
          ]
        },
        {
          "type": "pong",
          "fields": []
        },
        {
          "type": "error",
          "fields": [
            "message"
          ]
        }
      ]
    }
  },
  "deployment-topology.json": {
    "diagram_id": "Fig-2.4",
    "title": "Deployment Architecture (Web-Based Environment)",
    "section": "2.1.4",
    "description": "Production topology for browser-based deployment with TLS, static SPA hosting, ASGI API, PostgreSQL, and optional Redis for multi-worker WebSocket broadcast.",
    "format": "deployment_topology",
    "environments": {
      "development": {
        "frontend": {
          "host": "127.0.0.1:5173",
          "tool": "Vite dev server (HMR)"
        },
        "backend": {
          "host": "127.0.0.1:8000",
          "tool": "Daphne ASGI"
        },
        "database": {
          "engine": "SQLite",
          "path": "backend/db.sqlite3"
        },
        "redis": {
          "required": false,
          "fallback": "InMemoryChannelLayer"
        },
        "ai_pipeline": {
          "mode": "playground or stub",
          "gpu": "optional local CUDA"
        }
      },
      "production": {
        "frontend": {
          "host": "https://exam.example.com",
          "serve": "Nginx static (frontend/dist)"
        },
        "backend": {
          "host": "https://exam.example.com/api",
          "process": "Daphne behind Nginx upstream"
        },
        "websocket": {
          "host": "wss://exam.example.com/ws/",
          "upgrade": "Nginx proxy_http_version 1.1"
        },
        "database": {
          "engine": "PostgreSQL 15+",
          "host": "postgres.internal:5432"
        },
        "redis": {
          "required": true,
          "url": "redis://redis.internal:6379/0",
          "purpose": "Channels layer"
        },
        "ai_pipeline": {
          "mode": "playground",
          "gpu": "optional dedicated worker"
        }
      }
    },
    "nodes": [
      {
        "id": "user",
        "label": "End User (Browser)",
        "type": "external"
      },
      {
        "id": "cdn_optional",
        "label": "CDN (optional)",
        "type": "edge",
        "note": "Static asset caching"
      },
      {
        "id": "nginx",
        "label": "Nginx",
        "type": "edge",
        "ports": [
          "443 TLS",
          "80 redirect"
        ],
        "config_refs": [
          "docs/deployment.md \u00a77"
        ]
      },
      {
        "id": "spa_static",
        "label": "React SPA (dist/)",
        "type": "static",
        "path": "/var/www/exam-eye"
      },
      {
        "id": "daphne_1",
        "label": "Daphne Worker 1",
        "type": "compute",
        "port": 8000
      },
      {
        "id": "daphne_n",
        "label": "Daphne Worker N",
        "type": "compute",
        "note": "Horizontal scale"
      },
      {
        "id": "redis",
        "label": "Redis 7",
        "type": "cache",
        "purpose": "Channels broadcast"
      },
      {
        "id": "postgres",
        "label": "PostgreSQL",
        "type": "database"
      },
      {
        "id": "media_storage",
        "label": "Media Volume",
        "type": "storage",
        "path": "backend/media/"
      }
    ],
    "edges": [
      {
        "from": "user",
        "to": "cdn_optional",
        "label": "HTTPS (optional)"
      },
      {
        "from": "cdn_optional",
        "to": "nginx",
        "label": "origin"
      },
      {
        "from": "user",
        "to": "nginx",
        "label": "HTTPS direct"
      },
      {
        "from": "nginx",
        "to": "spa_static",
        "label": "GET / (try_files)"
      },
      {
        "from": "nginx",
        "to": "daphne_1",
        "label": "/api/, /ws/"
      },
      {
        "from": "nginx",
        "to": "daphne_n",
        "label": "load balance"
      },
      {
        "from": "daphne_1",
        "to": "postgres",
        "label": "ORM"
      },
      {
        "from": "daphne_n",
        "to": "postgres",
        "label": "ORM"
      },
      {
        "from": "daphne_1",
        "to": "redis",
        "label": "channel layer"
      },
      {
        "from": "daphne_n",
        "to": "redis",
        "label": "channel layer"
      },
      {
        "from": "daphne_1",
        "to": "media_storage",
        "label": "avatar uploads"
      }
    ],
    "cloud_options_within_scope": [
      {
        "provider": "Railway",
        "fit": "Recommended for capstone demo",
        "services": [
          "Web",
          "PostgreSQL",
          "Redis"
        ]
      },
      {
        "provider": "Render",
        "fit": "Free tier friendly",
        "services": [
          "Web service",
          "Managed Postgres"
        ]
      },
      {
        "provider": "DigitalOcean App Platform",
        "fit": "Simple VPS-style",
        "services": [
          "App",
          "Managed DB"
        ]
      },
      {
        "provider": "AWS Lightsail / EC2",
        "fit": "Self-managed Nginx stack",
        "services": [
          "VM",
          "RDS optional"
        ]
      },
      {
        "provider": "Azure App Service",
        "fit": "Institutional alignment",
        "services": [
          "App Service",
          "Azure Database"
        ]
      },
      {
        "provider": "On-premise campus VM",
        "fit": "Lab deployment",
        "services": [
          "Single VM",
          "Local PostgreSQL"
        ]
      }
    ],
    "security_controls_production": [
      "DJANGO_DEBUG=False",
      "Strong DJANGO_SECRET_KEY",
      "SECURE_SSL_REDIRECT + HSTS",
      "CORS_ALLOWED_ORIGINS whitelist",
      "JWT access/refresh TTL",
      "RBAC on all endpoints and WS connections"
    ]
  },
  "frontend-component.json": {
    "diagram_id": "Fig-2.5",
    "title": "Frontend Component Architecture",
    "section": "2.3",
    "description": "React 18 feature-based SPA structure with core providers, pages, and shared UI layer.",
    "format": "component_diagram",
    "technology_stack": {
      "framework": "React 18",
      "build": "Vite",
      "language": "TypeScript",
      "styling": "Tailwind CSS",
      "ui_library": "shadcn/ui (Radix primitives)",
      "charts": "Recharts",
      "routing": "React Router v6",
      "server_state": "TanStack React Query"
    },
    "layers": [
      {
        "name": "Core",
        "path": "frontend/src/core/",
        "modules": [
          {
            "name": "router",
            "role": "Public + protected routes, role guards"
          },
          {
            "name": "providers",
            "role": "Auth, Theme, Query, WebSocket context"
          },
          {
            "name": "config",
            "role": "env.ts, api.ts, constants"
          }
        ]
      },
      {
        "name": "Features",
        "path": "frontend/src/features/",
        "modules": [
          {
            "name": "auth",
            "pages": [
              "login",
              "register"
            ],
            "api": "token, profile"
          },
          {
            "name": "exams",
            "pages": [
              "dashboard list",
              "create modal"
            ],
            "api": "CRUD"
          },
          {
            "name": "session",
            "pages": [
              "exam-taking-backend"
            ],
            "api": "start, submit"
          },
          {
            "name": "monitoring",
            "hooks": [
              "use-monitoring"
            ],
            "api": "WS + REST frame"
          },
          {
            "name": "behavior",
            "role": "Alert/score display in inspector"
          },
          {
            "name": "reports",
            "pages": [
              "reports"
            ],
            "api": "summary, CSV, timeseries"
          },
          {
            "name": "profile",
            "pages": [
              "profile"
            ],
            "api": "avatar, password"
          }
        ]
      },
      {
        "name": "Pages (thin routing layer)",
        "path": "frontend/src/pages/",
        "public": [
          "home",
          "login",
          "register",
          "about",
          "features"
        ],
        "protected_admin": [
          "dashboard",
          "monitoring",
          "session-monitor",
          "reports"
        ],
        "protected_examinee": [
          "exam-taking-backend",
          "profile"
        ]
      },
      {
        "name": "Shared",
        "path": "frontend/src/shared/",
        "modules": [
          "components/ui/* (shadcn)",
          "hooks (use-debounce, use-local-storage, use-monitoring)",
          "utils/helpers.ts",
          "types/global.d.ts"
        ]
      }
    ],
    "providers": [
      {
        "name": "AuthProvider",
        "state": "user, tokens, login/logout, auto-refresh"
      },
      {
        "name": "ThemeProvider",
        "state": "dark/light mode"
      },
      {
        "name": "QueryProvider",
        "state": "React Query cache"
      },
      {
        "name": "WebSocketProvider",
        "state": "monitoring connections (where used)"
      }
    ],
    "role_based_routing": {
      "ADMIN": [
        "/dashboard",
        "/monitoring",
        "/reports",
        "/exams",
        "/profile"
      ],
      "EXAMINEE": [
        "/dashboard",
        "/exam/:id",
        "/profile",
        "/results"
      ]
    }
  },
  "rest-api-catalog.json": {
    "diagram_id": "Fig-3.3",
    "title": "REST API Surface Map",
    "section": "2.1.3.1 / 2.2.4",
    "description": "Complete REST endpoint catalog grouped by feature module. WebSocket endpoints documented separately in data-flow-monitoring.json.",
    "format": "api_catalog",
    "base_url_dev": "http://127.0.0.1:8000",
    "base_url_prod": "https://exam.example.com",
    "auth_header": "Authorization: Bearer <access_token>",
    "modules": [
      {
        "name": "Authentication",
        "base": "/api/auth",
        "endpoints": [
          {
            "method": "POST",
            "path": "/token/",
            "auth": false,
            "description": "Obtain JWT access + refresh"
          },
          {
            "method": "POST",
            "path": "/token/refresh/",
            "auth": false,
            "description": "Rotate access token"
          },
          {
            "method": "POST",
            "path": "/register/",
            "auth": false,
            "description": "Register new user"
          },
          {
            "method": "GET",
            "path": "/profile/me/",
            "auth": true,
            "description": "Current user profile"
          },
          {
            "method": "PATCH",
            "path": "/profile/update_profile/",
            "auth": true,
            "description": "Update profile fields"
          },
          {
            "method": "POST",
            "path": "/profile/avatar/",
            "auth": true,
            "description": "Upload avatar (multipart)"
          },
          {
            "method": "POST",
            "path": "/profile/change-password/",
            "auth": true,
            "description": "Change password"
          }
        ]
      },
      {
        "name": "Exams",
        "base": "/api/exams",
        "endpoints": [
          {
            "method": "GET",
            "path": "/",
            "auth": true,
            "description": "List exams (paginated)"
          },
          {
            "method": "POST",
            "path": "/",
            "auth": "ADMIN",
            "description": "Create exam"
          },
          {
            "method": "GET",
            "path": "/{id}/",
            "auth": true,
            "description": "Exam detail"
          },
          {
            "method": "PUT",
            "path": "/{id}/",
            "auth": "ADMIN",
            "description": "Full update"
          },
          {
            "method": "PATCH",
            "path": "/{id}/",
            "auth": "ADMIN",
            "description": "Partial update"
          },
          {
            "method": "DELETE",
            "path": "/{id}/",
            "auth": "ADMIN",
            "description": "Delete exam"
          },
          {
            "method": "POST",
            "path": "/{id}/publish/",
            "auth": "ADMIN",
            "description": "Publish draft \u2192 active"
          },
          {
            "method": "POST",
            "path": "/{id}/archive/",
            "auth": "ADMIN",
            "description": "Archive exam"
          },
          {
            "method": "GET",
            "path": "/{id}/questions/",
            "auth": true,
            "description": "List questions"
          },
          {
            "method": "POST",
            "path": "/{id}/questions/",
            "auth": "ADMIN",
            "description": "Add question"
          }
        ]
      },
      {
        "name": "Sessions",
        "base": "/api/sessions",
        "endpoints": [
          {
            "method": "GET",
            "path": "/",
            "auth": true,
            "description": "List sessions"
          },
          {
            "method": "GET",
            "path": "/{uuid}/",
            "auth": true,
            "description": "Session detail"
          },
          {
            "method": "POST",
            "path": "/start/",
            "auth": true,
            "description": "Start exam session"
          },
          {
            "method": "POST",
            "path": "/{uuid}/submit/",
            "auth": true,
            "description": "Submit answers + score"
          },
          {
            "method": "POST",
            "path": "/{uuid}/terminate/",
            "auth": "ADMIN",
            "description": "Force terminate"
          },
          {
            "method": "GET",
            "path": "/{uuid}/logs/",
            "auth": true,
            "description": "Session audit logs"
          }
        ]
      },
      {
        "name": "Monitoring",
        "base": "/api/monitoring",
        "endpoints": [
          {
            "method": "GET",
            "path": "/health/",
            "auth": false,
            "description": "Health + pipeline_mode"
          },
          {
            "method": "POST",
            "path": "/frame/",
            "auth": true,
            "description": "Analyze single base64 frame (REST fallback)"
          },
          {
            "method": "POST",
            "path": "/enroll/",
            "auth": true,
            "description": "Enroll reference face"
          }
        ],
        "websocket": [
          {
            "path": "/ws/monitoring/{session_uuid}/?token={jwt}",
            "auth": "JWT query",
            "description": "Per-session monitoring stream"
          },
          {
            "path": "/ws/monitoring/alerts/?token={jwt}",
            "auth": "ADMIN JWT",
            "description": "Global admin alert feed"
          }
        ]
      },
      {
        "name": "Behavior",
        "base": "/api/behavior",
        "endpoints": [
          {
            "method": "GET",
            "path": "/logs/?session={uuid}",
            "auth": true,
            "description": "Behavior event logs"
          },
          {
            "method": "GET",
            "path": "/alerts/?resolved=false",
            "auth": true,
            "description": "Unresolved alerts"
          },
          {
            "method": "POST",
            "path": "/alerts/{id}/resolve/",
            "auth": "ADMIN",
            "description": "Resolve alert"
          }
        ]
      },
      {
        "name": "Reports",
        "base": "/api/reports",
        "endpoints": [
          {
            "method": "GET",
            "path": "/summary/",
            "auth": "ADMIN",
            "description": "Dashboard KPIs"
          },
          {
            "method": "GET",
            "path": "/sessions/",
            "auth": "ADMIN",
            "description": "Paginated session reports"
          },
          {
            "method": "GET",
            "path": "/sessions/{uuid}/",
            "auth": "ADMIN",
            "description": "Full session report"
          },
          {
            "method": "GET",
            "path": "/timeseries/",
            "auth": "ADMIN",
            "description": "Daily activity series"
          },
          {
            "method": "GET",
            "path": "/export/csv/",
            "auth": "ADMIN",
            "description": "CSV download"
          }
        ]
      }
    ]
  },
  "sequence-exam-flow.json": {
    "diagram_id": "Fig-3.1",
    "title": "Exam Session Sequence Flow",
    "section": "1.2.3.1 / 2.1.3.1",
    "description": "End-to-end sequence from examinee login through exam completion with parallel monitoring.",
    "format": "sequence_diagram",
    "participants": [
      {
        "id": "examinee",
        "label": "Examinee (Browser)"
      },
      {
        "id": "frontend",
        "label": "React SPA"
      },
      {
        "id": "api",
        "label": "Django REST API"
      },
      {
        "id": "ws",
        "label": "WebSocket Consumer"
      },
      {
        "id": "ai",
        "label": "AI Adapter / Pipeline"
      },
      {
        "id": "db",
        "label": "PostgreSQL"
      }
    ],
    "messages": [
      {
        "order": 1,
        "from": "examinee",
        "to": "frontend",
        "type": "action",
        "label": "Login (username/password)"
      },
      {
        "order": 2,
        "from": "frontend",
        "to": "api",
        "type": "request",
        "method": "POST",
        "path": "/api/auth/token/",
        "label": "Obtain JWT"
      },
      {
        "order": 3,
        "from": "api",
        "to": "frontend",
        "type": "response",
        "label": "access + refresh tokens"
      },
      {
        "order": 4,
        "from": "examinee",
        "to": "frontend",
        "type": "action",
        "label": "Select exam \u2192 Start"
      },
      {
        "order": 5,
        "from": "frontend",
        "to": "api",
        "type": "request",
        "method": "POST",
        "path": "/api/sessions/start/",
        "body": "{ exam_id }"
      },
      {
        "order": 6,
        "from": "api",
        "to": "db",
        "type": "persist",
        "label": "Create ExamSession (UUID)"
      },
      {
        "order": 7,
        "from": "api",
        "to": "frontend",
        "type": "response",
        "label": "session_id, questions, timer"
      },
      {
        "order": 8,
        "from": "frontend",
        "to": "ws",
        "type": "connect",
        "path": "/ws/monitoring/{session_id}/?token=JWT",
        "label": "Open monitoring WebSocket"
      },
      {
        "order": 9,
        "from": "ws",
        "to": "frontend",
        "type": "event",
        "label": "connected + pipeline_mode"
      },
      {
        "order": 10,
        "from": "frontend",
        "to": "ws",
        "type": "message",
        "label": "enroll (reference face base64)"
      },
      {
        "order": 11,
        "from": "ws",
        "to": "ai",
        "type": "call",
        "label": "enroll_reference()"
      },
      {
        "order": 12,
        "from": "ai",
        "to": "db",
        "type": "persist",
        "label": "SessionIdentityReference"
      },
      {
        "order": 13,
        "from": "ws",
        "to": "frontend",
        "type": "event",
        "label": "enroll_result { ok: true }"
      },
      {
        "order": 14,
        "from": "examinee",
        "to": "frontend",
        "type": "parallel",
        "label": "Answer questions (loop)"
      },
      {
        "order": 15,
        "from": "frontend",
        "to": "api",
        "type": "request",
        "method": "POST",
        "path": "/api/sessions/{id}/submit/",
        "label": "Submit answers"
      },
      {
        "order": 16,
        "from": "api",
        "to": "db",
        "type": "persist",
        "label": "Responses + score calculation"
      },
      {
        "order": 17,
        "from": "api",
        "to": "frontend",
        "type": "response",
        "label": "total_score, passed, percentage"
      },
      {
        "order": 18,
        "from": "frontend",
        "to": "ws",
        "type": "disconnect",
        "label": "Close monitoring stream"
      }
    ],
    "parallel_region": {
      "name": "Monitoring (runs during steps 14\u201317)",
      "messages": [
        {
          "from": "frontend",
          "to": "ws",
          "interval": "~200\u20131000ms",
          "label": "frame { image: base64 }"
        },
        {
          "from": "ws",
          "to": "ai",
          "label": "analyze_frame_bgr()"
        },
        {
          "from": "ai",
          "to": "ws",
          "label": "metrics, events, alerts"
        },
        {
          "from": "ws",
          "to": "db",
          "label": "persist_analysis \u2192 behavior_log, alert"
        },
        {
          "from": "ws",
          "to": "frontend",
          "label": "analysis + alert payloads"
        }
      ]
    },
    "mermaid_placeholder": "sequenceDiagram\n  participant E as Examinee\n  participant FE as React SPA\n  participant API as REST API\n  participant WS as WebSocket\n  participant AI as AI Pipeline\n  participant DB as Database\n  E->>FE: Login\n  FE->>API: POST /api/auth/token/\n  API-->>FE: JWT\n  FE->>API: POST /api/sessions/start/\n  API->>DB: Create session\n  API-->>FE: session + questions\n  FE->>WS: Connect /ws/monitoring/{id}/\n  par Monitoring loop\n    FE->>WS: frame\n    WS->>AI: analyze\n    AI-->>WS: results\n    WS->>DB: persist\n    WS-->>FE: analysis/alert\n  and Exam taking\n    FE->>API: submit answers\n    API->>DB: score\n    API-->>FE: results\n  end"
  },
  "system-architecture.json": {
    "diagram_id": "Fig-2.1",
    "title": "High-Level System Architecture",
    "section": "2.1.1 / 2.1.2",
    "description": "Modular monolith with four primary components: Frontend SPA, Django backend (REST + WebSocket), AI/CV pipeline module, and relational database. Redis supports horizontal WebSocket scaling in production.",
    "format": "directed_graph",
    "render_hints": {
      "tools": [
        "draw.io",
        "Lucidchart",
        "Mermaid",
        "dbdiagram.io (for ERD only)"
      ],
      "mermaid_template": "flowchart TB\n  subgraph Client[\"Client Tier\"]\n    FE[React SPA]\n    CAM[Webcam API]\n  end\n  subgraph Edge[\"Edge Tier\"]\n    NG[Nginx TLS]\n  end\n  subgraph App[\"Application Tier\"]\n    API[Django DRF + Channels]\n    REDIS[(Redis)]\n    AI[AI Adapter \u2192 backend/ai/knowing_eye]\n  end\n  subgraph Data[\"Data Tier\"]\n    DB[(PostgreSQL)]\n  end\n  FE -->|REST| NG\n  FE -->|WebSocket| NG\n  CAM --> FE\n  NG --> API\n  API --> REDIS\n  API --> AI\n  API --> DB"
    },
    "nodes": [
      {
        "id": "examinee_browser",
        "label": "Examinee Browser",
        "tier": "client",
        "technology": "Chrome/Edge/Firefox",
        "responsibilities": [
          "Exam UI",
          "Webcam capture",
          "WebSocket client"
        ]
      },
      {
        "id": "admin_browser",
        "label": "Administrator Browser",
        "tier": "client",
        "technology": "Chrome/Edge/Firefox",
        "responsibilities": [
          "Dashboard",
          "Live monitoring grid",
          "Reports"
        ]
      },
      {
        "id": "frontend_spa",
        "label": "Frontend SPA",
        "tier": "client",
        "technology": "React 18, Vite, TypeScript, Tailwind",
        "responsibilities": [
          "Routing",
          "Auth state",
          "API client",
          "Monitoring hooks"
        ]
      },
      {
        "id": "nginx",
        "label": "Reverse Proxy",
        "tier": "edge",
        "technology": "Nginx",
        "responsibilities": [
          "TLS termination",
          "Static SPA",
          "HTTP + WS proxy"
        ]
      },
      {
        "id": "django_asgi",
        "label": "Django ASGI Server",
        "tier": "application",
        "technology": "Daphne / Uvicorn",
        "responsibilities": [
          "HTTP REST",
          "WebSocket consumers"
        ]
      },
      {
        "id": "drf",
        "label": "Django REST Framework",
        "tier": "application",
        "technology": "DRF + SimpleJWT",
        "responsibilities": [
          "CRUD APIs",
          "JWT auth",
          "Serialization"
        ]
      },
      {
        "id": "channels",
        "label": "Django Channels",
        "tier": "application",
        "technology": "Channels 4",
        "responsibilities": [
          "WebSocket routing",
          "Group broadcast",
          "Async consumers"
        ]
      },
      {
        "id": "feature_modules",
        "label": "Feature Modules",
        "tier": "application",
        "technology": "Django apps",
        "responsibilities": [
          "auth",
          "exams",
          "session",
          "monitoring",
          "behavior",
          "reports"
        ]
      },
      {
        "id": "ai_adapter",
        "label": "AI Adapter",
        "tier": "application",
        "technology": "backend/ai/adapter.py",
        "responsibilities": [
          "Lazy pipeline load",
          "Stub fallback",
          "Thread-safe init"
        ]
      },
      {
        "id": "cv_pipeline",
        "label": "Behavior Pipeline",
        "tier": "ai",
        "technology": "backend/ai/knowing_eye",
        "responsibilities": [
          "Detection",
          "Recognition",
          "Scoring",
          "Alerts"
        ]
      },
      {
        "id": "redis",
        "label": "Redis",
        "tier": "infrastructure",
        "technology": "Redis 7",
        "responsibilities": [
          "Channel layer",
          "Optional cache"
        ]
      },
      {
        "id": "postgresql",
        "label": "PostgreSQL",
        "tier": "data",
        "technology": "PostgreSQL 15+ (SQLite dev)",
        "responsibilities": [
          "Users",
          "Exams",
          "Sessions",
          "Logs",
          "Alerts"
        ]
      }
    ],
    "edges": [
      {
        "from": "examinee_browser",
        "to": "frontend_spa",
        "protocol": "local",
        "label": "renders"
      },
      {
        "from": "admin_browser",
        "to": "frontend_spa",
        "protocol": "local",
        "label": "renders"
      },
      {
        "from": "frontend_spa",
        "to": "nginx",
        "protocol": "HTTPS",
        "label": "REST /api/*"
      },
      {
        "from": "frontend_spa",
        "to": "nginx",
        "protocol": "WSS",
        "label": "WebSocket /ws/*"
      },
      {
        "from": "nginx",
        "to": "django_asgi",
        "protocol": "HTTP/WS",
        "label": "proxy_pass"
      },
      {
        "from": "django_asgi",
        "to": "drf",
        "protocol": "internal",
        "label": "HTTP views"
      },
      {
        "from": "django_asgi",
        "to": "channels",
        "protocol": "internal",
        "label": "WS consumers"
      },
      {
        "from": "drf",
        "to": "feature_modules",
        "protocol": "internal",
        "label": "views \u2192 services"
      },
      {
        "from": "channels",
        "to": "feature_modules",
        "protocol": "internal",
        "label": "monitoring consumer"
      },
      {
        "from": "feature_modules",
        "to": "ai_adapter",
        "protocol": "function_call",
        "label": "analyze_frame_bgr()"
      },
      {
        "from": "ai_adapter",
        "to": "cv_pipeline",
        "protocol": "Python import",
        "label": "BehaviorPipeline"
      },
      {
        "from": "feature_modules",
        "to": "postgresql",
        "protocol": "ORM/SQL",
        "label": "read/write"
      },
      {
        "from": "channels",
        "to": "redis",
        "protocol": "Redis pub/sub",
        "label": "channel layer"
      }
    ],
    "layers": [
      {
        "name": "Presentation",
        "nodes": [
          "examinee_browser",
          "admin_browser",
          "frontend_spa"
        ]
      },
      {
        "name": "Edge / Delivery",
        "nodes": [
          "nginx"
        ]
      },
      {
        "name": "Application",
        "nodes": [
          "django_asgi",
          "drf",
          "channels",
          "feature_modules",
          "ai_adapter"
        ]
      },
      {
        "name": "AI / Analytics",
        "nodes": [
          "cv_pipeline"
        ]
      },
      {
        "name": "Infrastructure",
        "nodes": [
          "redis"
        ]
      },
      {
        "name": "Persistence",
        "nodes": [
          "postgresql"
        ]
      }
    ]
  }
};
window.KNOWING_EYE_DBML = "// Knowing Eye \u2014 Entity-Relationship Diagram (DBML)\n// Source: Django models in backend/features/\n// Render at: https://dbdiagram.io  |  Export PNG/SVG for paper figures\n// Figure ID: Fig-4.1\n\nProject KnowingEye {\n  database_type: 'PostgreSQL'\n  Note: '''\n    Production: PostgreSQL 15+\n    Development: SQLite (django.db.backends.sqlite3)\n    Naming: snake_case table names via db_table Meta\n  '''\n}\n\n// \u2500\u2500\u2500 Authentication \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nTable authentication_user {\n  id integer [pk, increment, note: 'Django AutoField PK']\n  username varchar(150) [unique, not null]\n  email varchar(254) [unique, not null]\n  password varchar(128) [not null, note: 'Hashed via Django auth']\n  first_name varchar(150)\n  last_name varchar(150)\n  role varchar(20) [not null, default: 'EXAMINEE', note: 'ADMIN | EXAMINEE']\n  avatar varchar(100) [null, note: 'ImageField \u2192 media/avatars/']\n  phone varchar(32)\n  institution varchar(255)\n  student_id varchar(64)\n  is_active boolean [default: true]\n  is_staff boolean [default: false]\n  is_superuser boolean [default: false]\n  last_login datetime [null]\n  last_seen_at datetime [null]\n  date_joined datetime\n  created_at datetime\n  updated_at datetime\n\n  indexes {\n    role\n  }\n}\n\n// \u2500\u2500\u2500 Exams \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nTable exams_exam {\n  id integer [pk, increment]\n  title varchar(255) [not null]\n  description text\n  instructions text\n  duration_minutes integer [default: 120]\n  total_questions integer [default: 0]\n  passing_score integer [default: 40, note: 'Percentage 0\u2013100']\n  exam_code varchar(32) [unique, null]\n  available_from datetime [null]\n  available_until datetime [null]\n  max_attempts integer [default: 1]\n  status varchar(20) [default: 'draft', note: 'draft | active | archived']\n  created_by_id integer [not null, ref: > authentication_user.id]\n  created_at datetime\n  updated_at datetime\n\n  indexes {\n    (status, created_at)\n    created_by_id\n    exam_code\n    (available_from, available_until)\n  }\n}\n\nTable exams_question {\n  id integer [pk, increment]\n  exam_id integer [not null, ref: > exams_exam.id]\n  question_text text [not null]\n  question_type varchar(20) [default: 'multiple_choice', note: 'multiple_choice | true_false | short_answer | essay']\n  options json [default: '[]', note: 'MCQ option list']\n  correct_answer text [not null]\n  points integer [default: 1]\n  order integer [default: 0]\n  created_at datetime\n  updated_at datetime\n\n  indexes {\n    (exam_id, order) [unique]\n  }\n}\n\n// \u2500\u2500\u2500 Sessions & Responses \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nTable user_sessions_exam_session {\n  id uuid [pk, note: 'UUID primary key']\n  exam_id integer [not null, ref: > exams_exam.id]\n  user_id integer [not null, ref: > authentication_user.id]\n  started_at datetime [not null]\n  submitted_at datetime [null]\n  time_remaining integer [default: 0, note: 'Seconds remaining at submit']\n  status varchar(20) [default: 'in_progress', note: 'in_progress | completed | terminated | expired']\n  ip_address varchar(45) [null]\n  user_agent text [null]\n  total_score integer [null]\n  percentage_score decimal(5,2) [null]\n  passed boolean [null]\n\n  indexes {\n    (exam_id, user_id)\n    (status, started_at)\n    (user_id, started_at)\n  }\n\n  Note: 'Unique constraint: one in_progress session per (exam, user)'\n}\n\nTable user_sessions_response {\n  id integer [pk, increment]\n  session_id uuid [not null, ref: > user_sessions_exam_session.id]\n  question_id integer [not null, ref: > exams_question.id]\n  answer_text text [not null]\n  is_correct boolean [default: false]\n  time_spent integer [default: 0, note: 'Seconds on question']\n  answered_at datetime\n  flagged_for_review boolean [default: false]\n\n  indexes {\n    (session_id, question_id) [unique]\n    is_correct\n    flagged_for_review\n  }\n}\n\nTable user_sessions_session_log {\n  id integer [pk, increment]\n  session_id uuid [not null, ref: > user_sessions_exam_session.id]\n  event_type varchar(20) [note: 'started | submitted | terminated | expired | resumed | paused']\n  timestamp datetime\n  details json [default: '{}']\n  ip_address varchar(45) [null]\n\n  indexes {\n    (session_id, timestamp)\n    (event_type, timestamp)\n  }\n}\n\n// \u2500\u2500\u2500 Behavior & Monitoring \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nTable behavior_log {\n  id uuid [pk]\n  session_id uuid [not null, ref: > user_sessions_exam_session.id]\n  event_type varchar(32) [note: 'no_face | multiple_faces | looking_away | bad_posture | leaving_seat | object_detected | identity_mismatch | suspicious_pattern']\n  score float [note: 'Compliance 0.0\u20131.0']\n  confidence float [default: 0]\n  metadata json [default: '{}']\n  timestamp datetime\n\n  indexes {\n    (session_id, timestamp)\n    event_type\n  }\n}\n\nTable behavior_alert {\n  id uuid [pk]\n  session_id uuid [not null, ref: > user_sessions_exam_session.id]\n  alert_type varchar(64)\n  severity varchar(16) [default: 'medium', note: 'low | medium | high']\n  message text\n  metric_pct float [null]\n  resolved boolean [default: false]\n  created_at datetime\n\n  indexes {\n    (session_id, created_at)\n    resolved\n  }\n}\n\nTable monitoring_identity_reference {\n  id uuid [pk]\n  session_id uuid [unique, not null, ref: - user_sessions_exam_session.id, note: 'OneToOne per session']\n  embedding json [default: '[]', note: 'Serialised face embedding vector']\n  backend varchar(32) [default: 'stub', note: 'stub | playground | arcface']\n  dims integer [default: 0]\n  created_at datetime\n  updated_at datetime\n}\n\n// \u2500\u2500\u2500 Relationship summary (for paper narrative) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// authentication_user 1\u2500\u2500* exams_exam (created_by)\n// exams_exam          1\u2500\u2500* exams_question\n// exams_exam          1\u2500\u2500* user_sessions_exam_session\n// authentication_user 1\u2500\u2500* user_sessions_exam_session\n// user_sessions_exam_session 1\u2500\u2500* user_sessions_response\n// exams_question      1\u2500\u2500* user_sessions_response\n// user_sessions_exam_session 1\u2500\u2500* user_sessions_session_log\n// user_sessions_exam_session 1\u2500\u2500* behavior_log\n// user_sessions_exam_session 1\u2500\u2500* behavior_alert\n// user_sessions_exam_session 1\u2500\u25001 monitoring_identity_reference\n";
