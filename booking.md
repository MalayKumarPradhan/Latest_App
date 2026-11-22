# Implementation Plan

1. Replace the current demo-only auth form with a Material 3 login, registration, and three-step password-recovery flow.
2. Validate names, email/mobile identifiers, strong passwords, confirmation, and required terms before sending requests.
3. Wire the mobile client to the Node.js API and show API/validation errors rather than signing in through a success-shaped fallback.
4. Extend the API for email/mobile signup and login, duplicate detection, generic recovery responses, OTP verification, and password reset.
5. Enforce API request limits and a 15-minute lockout after five failed logins; persist recovery and lockout state in SQL Server.
6. Configure email/SMS delivery through environment-based providers, document required database and provider setup, then run focused checks.

---

# Authentication System Guidelines & Implementation Instructions

This document provides comprehensive design, UX, validation, and technical guidelines for building a secure and user-friendly Authentication Suite containing **Registration**, **Login** (supporting Email or Mobile Number), and **Forgot Password** screens, along with backend authentication standards.

---

## 1. Registration Screen

### A. UI & Field Requirements

* **Full Name**: Text input (Min 2 characters, alpha-numeric with spaces).
* **Email or Mobile Number**: Unified or tabbed input field. If unified, the system should intelligently detect whether the input is a valid email or a 10-digit mobile number.
* **Password**: Secure text input with a show/hide toggle.
* *Requirements:* Minimum 8 characters, at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.


* **Confirm Password**: Must match the password field.
* **Terms & Conditions**: Checkbox (mandatory for submission).
* **Primary CTA**: "Register" or "Sign Up" button.
* **Alternative Action**: "Already have an account? Log In" link.

### B. Validation & Error Handling

* **Real-time feedback**: Validate format errors on blur or input change.
* **Duplicate Check**: If the email or mobile number already exists in the database, display an inline error: *"This email/mobile number is already registered. Please log in."*
* **Success State**: Trigger an OTP verification step (via SMS/Email) or automatically log the user in and redirect to the dashboard.

---

## 2. Login Screen

### A. UI & Field Requirements

* **Identifier (Email / Mobile Number)**: Single flexible input field. Label: *“Email or Mobile Number”*.
* **Password**: Secure text input with show/hide toggle.
* **Remember Me**: Checkbox to persist session tokens securely.
* **Forgot Password**: Text button aligned to the right (*“Forgot Password?”*).
* **Primary CTA**: "Log In" button.
* **Alternative Action**: "Don't have an account? Sign Up" link.

### B. Validation & Error Handling

* **Input Detection**: Automatically detect if the input string contains an `@` symbol (Email) or is numeric (Mobile Number).
* **Invalid Credentials**: Display a generic, secure error message to prevent enumeration attacks: *"Invalid email/mobile number or password."*
* **Account Lockout**: Temporarily lock the account (e.g., 15 minutes) after 5 consecutive failed login attempts, showing a rate-limit warning.

---

## 3. Forgot Password Screen

### A. Multi-Step Flow

* **Step 1: Request Recovery**
* Input: Registered Email or Mobile Number.
* CTA: "Send Verification Code" / "Reset Link".
* Validation: Check if the identifier exists in the system. (Tip: Show a generic success message regardless to prevent user enumeration: *"If this account exists, instructions have been sent."*)


* **Step 2: Verify OTP / Token**
* Input: 4 to 6-digit OTP code sent via SMS/Email with a countdown timer (e.g., 60 seconds) for resending.
* CTA: "Verify Code".


* **Step 3: Reset Password**
* Input: New Password and Confirm New Password (same strict criteria as Registration).
* CTA: "Update Password & Log In".



---

## 4. Authentication & Security Architecture

### A. Token Management

* **JWT (JSON Web Tokens)**: Implement a dual-token strategy:
* **Access Token**: Short-lived (e.g., 15 minutes) stored in memory (or secure client storage).
* **Refresh Token**: Long-lived (e.g., 7 days) stored securely in HttpOnly, Secure, SameSite cookies.


* **Logout Mechanism**: Invalidate the refresh token on the server side and clear client-side storage.

### B. Security Best Practices

* **Password Hashing**: Use **bcrypt** (or Argon2) with an appropriate salt rounds factor (minimum 10) on the backend. Never store plain-text passwords.
* **Rate Limiting**: Apply rate-limiting middleware (e.g., using Redis) on sensitive endpoints:
* `/api/auth/login`: Max 5 requests per minute per IP.
* `/api/auth/forgot-password`: Max 3 requests per 10 minutes per IP/identifier.


* **HTTPS Enforcement**: Ensure all authentication payloads are transmitted over encrypted TLS/SSL channels.

---

## 5. Summary Quick Reference Table

| Screen | Key Inputs | Primary Validation | Post-Action Destination |
| --- | --- | --- | --- |
| **Registration** | Name, Email/Mobile, Password | Regex for format + Duplicate check | OTP Verification / Dashboard |
| **Login** | Email/Mobile, Password | Identifier detection + Credential match | App Dashboard / Home |
| **Forgot Password** | Email/Mobile $\rightarrow$ OTP $\rightarrow$ New Password | Exists check $\rightarrow$ Code match $\rightarrow$ Strength check | Login Screen |

## using node js api 
api should add here :
E:\Malay\Latest\bus-booking-app-api