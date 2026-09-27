# Odoo Hackathon - StockSense

StockSense is a warehouse inventory management application built for a hackathon challenge. The project combines a React frontend with a Flask backend to manage products, stock movements, warehouse operations, and analytics for inventory teams.

## Overview

This monorepo includes:

- frontend/ - React + Vite dashboard for warehouse operations
- backend/ - Flask REST API with authentication and inventory services
- infra/ - Docker infrastructure setup
- scripts/ - helper scripts for local setup and seeding

## Core capabilities

- Product and category management
- Warehouse and location tracking
- Stock receipts, deliveries, transfers, and adjustments
- Inventory ledger and operational history
- Dashboard KPIs and analysis views
- Role-based access for warehouse staff and managers
- JWT-based authentication and password reset workflow

## Tech stack

- Frontend: React, Vite, JavaScript
- Backend: Python, Flask, PyMySQL, PyJWT
- Database: MySQL
- Infrastructure: Docker Compose

## Project structure

- backend/app.py - Flask application entry point
- backend/routes/ - API blueprints for products, stock, auth, dashboard, and operations
- backend/services/ - business logic for analysis and inventory flows
- backend/models/ - database models for inventory entities
- frontend/src/ - UI pages, components, and API integration

## Getting started

### Backend

1. Open a terminal in the backend folder.
2. Create and activate a virtual environment if needed.
3. Install dependencies:

   pip install -r requirements.txt

4. Copy `.env.example` to `.env` and configure the database and SMTP values. For real OTP delivery with Gmail:
   - Enable 2-Step Verification on the Google account, then create an App Password.
   - Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USE_TLS=true`, and use the Gmail address for both `SMTP_USERNAME` and `SMTP_FROM`.
   - Set `SMTP_PASSWORD` to the generated App Password, not the normal Google account password. Keep `.env` private and never commit real credentials.
5. Start the API:

   python app.py

The backend runs on http://127.0.0.1:5000. Signup verification and password-reset OTP emails are sent synchronously through authenticated SMTP during their API requests. New signup accounts cannot sign in until their email is verified; codes expire after 10 minutes, allow up to 5 attempts, and can be resent once every 30 seconds. Password reset requires a short-lived, single-use grant issued after OTP verification. Delivery/configuration failures return an error instead of claiming the code was sent.

### Frontend

1. Open a terminal in the frontend folder.
2. Install dependencies:

   npm install

3. Ensure `.env` has `VITE_USE_MOCKS=false` so OTP requests reach the real backend (the example file already sets this).
4. Run the app:

   npm run dev

The frontend is typically served on http://localhost:5173.

## Notes

This project is intended for local development and hackathon demonstration use. The repository includes API documentation in backend/API_HANDOFF.md and environment examples in backend/.env.example.
