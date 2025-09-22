ARCHITECTURE.md
# 📐 FAMU Career Assistant - System Architecture

## 🧭 Overview
The FAMU Career Assistant is a web-based platform designed to help FAMU students discover job opportunities tailored to their major, interests, and experience. It includes personalized dashboards, resume parsing, job recommendations, and event notifications.

---

## 🖼️ Architecture Diagram
<img width="1024" height="1536" alt="ChatGPT Image Sep 22, 2025, 03_33_19 PM" src="https://github.com/user-attachments/assets/02f1cfc6-9baa-4e02-91bd-282803874221" />


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
- Hosted on MongoDB Atlas
- Collections:
  - `advancedqas`
  - `jobmatches`
  - `results`
  - `users`
    
---

### 4. 🧱 MERN Stack Infrastructure

- **React.js (Frontend)**:  
  - Handles all user interface and interaction logic  
  - Communicates with the backend via REST APIs using Axios or Fetch  

- **Express.js + Node.js (Backend)**:  
  - Serves as the API layer and business logic handler  
  - Processes routes for login, job matching, resume upload, etc.  

- **MongoDB (Database)**:  
  - Stores user profiles, job listings, events, and application history  
  - Managed using Mongoose ORM  


---

### 5. ⚙️ DevOps & Tooling

- **GitHub** for version control and collaboration  
- **GitHub Actions** used for:
  - CI pipeline with auto-build and unit testing
  - Linting enforcement (≥50% coverage for Sprint 1)
- **Environment config**: `.env.example` file provided (no secrets in repo)

---

## 🔁 Data Flow Summary

1. User logs in through the React UI → sends credentials to Express API  
2. Profile form is submitted → stored in MongoDB   
3. Job matches are calculated → ranked and sent back to frontend  
5. User actions (save/apply) are stored in the applications collection

---

## 🔐 Security & Compliance

- No sensitive keys or tokens stored in the codebase   
- App includes basic accessibility (keyboard nav, alt text)  
- FERPA-safe data handling using anonymized mock data

---

## 📊 Logs & Monitoring

- Basic error logging implemented on the backend  
- Logs can be extended to file or cloud-based services if needed

---

## 📈 Scalability

- MERN stack is modular and ready for scaling with:
  - Load balancing via NGINX or PM2 clusters
  - MongoDB Atlas for cloud-hosted, auto-scaling DB

---

## 🧪 Testing

- Unit tests implemented using Jest / React Testing Library  
- CI pipeline ensures code is linted and passes tests before merging  

---

## 🧠 AI Usage (Sprint 1)

AI was used to support:
- Architecture diagram design  
- Markdown formatting for this file  

---

_Last updated: Sept 2025_
---

_Last updated: Sept 2025_

