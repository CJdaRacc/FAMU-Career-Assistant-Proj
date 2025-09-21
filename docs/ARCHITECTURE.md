ARCHITECTURE.md
[comment]: # (FILE WAS CREATED 9/10/25 - CALVIN MITCHELL)
# 📐 FAMU Career Assistant - System Architecture

## 🧭 Overview
The FAMU Career Assistant is a web-based platform designed to help FAMU students discover job opportunities tailored to their major, interests, and experience. It includes personalized dashboards, resume parsing, job recommendations, and event notifications.

---

## 🖼️ Architecture Diagram
![System Architecture](./famu-aws-architecture.png)  
> Located in `/docs/famu-aws-architecture.png`

---

## ⚙️ System Components

### 1. **Frontend (UI)**
- Built using HTML, CSS, JS (Bootstrap, FontAwesome)
- Key Pages:
  - Login
  - Profile & Questionnaire
  - Dashboard (Job Matches, Resume Feedback)
- Connected to backend via REST API

---

### 2. **Backend Services (Node.js/Python)**
- **Authentication Service**: Handles login/logout
- **Profile Service**: Manages student data (major, interests)
- **Resume Parser**: Extracts skills for matching
- **Job Matching Engine**: Ranks jobs by match %
- **Application Tracker**: Handles "Save" & "Apply" states

---

### 3. **Database**
- Hosted on Amazon RDS (PostgreSQL)
- Tables:
  - `students`
  - `resumes`
  - `jobs`, `job_skills`
  - `events`
  - `applications`

---

### 4. **Cloud Infrastructure (AWS)**
- **Amazon Route 53**: Domain management
- **CloudFront**: Asset CDN & caching
- **Elastic Load Balancer**: Distributes traffic to EC2
- **EC2 Instances** (in Auto Scaling Group): Hosts backend services
- **EBS Volumes**: App & data storage
- **Amazon S3**: Resume files, logs
- **EBS Snapshots**: Backups

---

### 5. **DevOps Tooling**
- GitHub for version control
- GitHub Actions:
  - Auto CI for PRs
  - Linting + Unit Tests (≥50% coverage)
- `.env.example` used for safe environment setup

---

## 🔁 Data Flow Summary
1. User logs in via UI → Auth API
2. Profile data submitted → Stored in DB
3. Resume uploaded → Parsed → Skills matched with job postings
4. Matched jobs displayed on dashboard
5. Users can save/apply → Application status stored

---

## 🔐 Security & Compliance
- No secrets in repo
- Resume file limits (size/type)
- Accessibility basics: Keyboard nav, alt text
- FERPA-compliant mock data

---

## 📊 Monitoring & Logs
- Logs written to Amazon S3
- Basic action/error logging in place

---

## 📈 Scalability
- Auto Scaling Group for backend EC2
- CloudFront for static file delivery
- Pagination/lazy loading on dashboard

---

## 🧪 Testing
- Unit tests integrated into CI pipeline
- Code must pass linting + tests before merge

---

## 🧠 AI Usage (Sprint 1)
AI-supported in:
- Resume parsing suggestions
- Diagram generation
- Architecture documentation (this file)

---

_Last updated: Sept 2025_

