# ⚡ Brightloop Subscription Management System
> **Odoo Hackathon Solution** — A full-stack, enterprise-grade, responsive, and secure Subscription Management, Recurring Invoicing, and Customer Self-Service Portal.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-35%2F35_Passing-brightgreen?logo=jest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📋 Table of Contents
- [1. Project Overview & Problem Statement](#1-project-overview--problem-statement)
- [2. Brightloop Software Case Study Implementation](#2-brightloop-software-case-study-implementation)
- [3. Technology Stack](#3-technology-stack)
- [4. System Architecture & Workflows](#4-system-architecture--workflows)
  - [High-Level Architecture](#high-level-architecture)
  - [Quotation-to-Subscription Workflow](#quotation-to-subscription-workflow)
  - [Subscription Lifecycle State Machine](#subscription-lifecycle-state-machine)
  - [Idempotent Recurring Billing Engine](#idempotent-recurring-billing-engine)
  - [Payment Reconciliation Workflow](#payment-reconciliation-workflow)
- [5. User Roles & Permission Matrix](#5-user-roles--permission-matrix)
- [6. Core Feature Modules](#6-core-feature-modules)
- [7. Quick Demo Credentials & One-Click Switcher](#7-quick-demo-credentials--one-click-switcher)
- [8. Local Setup & Installation Guide](#8-local-setup--installation-guide)
- [9. Running the Automated Test Suite](#9-running-the-automated-test-suite)
- [10. REST API Specification](#10-rest-api-specification)
- [11. Free-Tier Production Deployment Guide](#11-free-tier-production-deployment-guide)

---

## 1. Project Overview & Problem Statement

Managing subscription-based SaaS products, hardware leases, and recurring professional services often suffers from:
1. **Manual Invoicing Errors**: Billing dates missed, incorrect plan pricing, or delayed renewals.
2. **Double-Billing Disasters**: Race conditions triggering duplicate invoices for the same billing cycle.
3. **Payment Reconciliation Gaps**: Unmatched bank transfers, partial payments left untracked, and zero visibility into overdue receivables.
4. **Revenue Blindness**: Inability to calculate live MRR (Monthly Recurring Revenue), ARR, churn, and collection rates.

### The Solution
The **Brightloop Subscription Management System** solves these challenges end-to-end:
* Eliminates manual invoicing with an **idempotent, automated cron billing engine**.
* Enforces **database-level unique billing constraints** to guarantee zero duplicate invoices.
* Provides **live financial calculations** with multi-variant products, customizable discount rules, and dynamic tax engines.
* Empowers customers with a **dedicated self-service portal** while safeguarding strict customer data isolation.
* Built exclusively using **100% free and open-source technologies** with zero paid API dependencies.

---

## 2. Brightloop Software Case Study Implementation

The application contains built-in demonstration seed data matching the hackathon case study:

| Component | Value | Calculation |
| :--- | :--- | :--- |
| **Base Product** | Brightloop ERP Core Suite | ₹12,000.00 / month |
| **Product Variant** | Odoo Integration Brand Variant | **+₹560.00** |
| **Subtotal (Base + Variant)** | Core + Odoo Variant | **₹12,560.00** |
| **Promotional Discount** | 10% First-Time Customer Discount | **-₹1,256.00** |
| **Taxable Amount** | Subtotal - Discount | **₹11,304.00** |
| **Applicable Tax** | 18% GST (Goods and Services Tax) | **+₹2,034.72** |
| **Final Billed Amount** | Total Payable | **₹13,338.72** |

*(All automated unit and integration tests verify this exact mathematical reconciliation to 2 decimal places).*

---

## 3. Technology Stack

### Frontend
* **React 19 with Vite**: Lightning-fast modern build tooling and component rendering.
* **React Router DOM v7**: Seamless client-side routing, protected routes, and role-based route guards.
* **Tailwind CSS v3**: Clean, responsive, mobile-first design with a modern slate-and-indigo aesthetic.
* **Recharts**: Interactive dashboard charts (Revenue trends, Payment distributions, Plan subscriber share).
* **Lucide React**: Crisp, modern icon library.
* **jsPDF & html2canvas**: High-fidelity, client-side downloadable PDF invoice generation.
* **Axios**: HTTP client with global JWT request interceptors and error handling.

### Backend
* **Node.js & Express.js**: RESTful API architecture following clean controller-service separation.
* **JWT (JSON Web Tokens)**: Secure, stateless authentication with role-scoped claims (`admin`, `staff`, `customer`).
* **bcryptjs**: Secure one-way salt hashing (10 salt rounds) for password security.
* **express-rate-limit**: API brute-force protection on authentication and billing endpoints.
* **dotenv**: Comprehensive configuration management.

### Database Engine (Dual Mode)
* **Production**: **PostgreSQL** hosted on **Supabase Free Tier**.
* **Zero-Config Local Evaluation**: In-memory PostgreSQL engine (`pg-mem`) featuring automatic disk persistence (`server/data/db_snapshot.json`). Evaluators can clone and run without installing local PostgreSQL or creating external accounts!
* **Sequence Synchronization**: Custom prototype hooks and dynamic sequence synchronizers guarantee primary key integrity without sequence collision.

### Automation & Scheduling
* **node-cron**: Scheduled background jobs for recurring billing, 7-day renewal alerts, overdue invoice marking, and subscription expiry detection.
* **GitHub Actions Workflow**: `.github/workflows/billing-cron.yml` triggers deployed headless billing runs daily at 00:00 UTC.
* **Audit Logging Engine**: Automatically records actor identity, IP address, timestamp, previous state, and updated state for every system mutation.

---

## 4. System Architecture & Workflows

### High-Level Architecture

```mermaid
flowchart TD
    subgraph Clients["Clients & UI Layer"]
        A["Admin Dashboard\n(Platform & Team Mgmt)"]
        B["Staff Workspace\n(Quotations & Payments)"]
        C["Customer Portal\n(Self-Service & PDF Invoices)"]
    end

    subgraph API["Backend API (Express.js)"]
        D["JWT Auth & Role Guard"]
        E["Quotation & Subscription Service"]
        F["Idempotent Billing Engine"]
        G["Payment Reconciliation Service"]
        H["Automation Hub (node-cron)"]
    end

    subgraph DB["PostgreSQL Database (Supabase / In-Memory)"]
        I[("Users & Roles")]
        J[("Products & Variants")]
        K[("Quotations & Subscriptions")]
        L[("Invoices & Line Items")]
        M[("Payments & Audit Logs")]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    D --> F
    D --> G
    H --> F
    E --> J
    E --> K
    F --> L
    G --> M
    L --> M
```

---

### Quotation-to-Subscription Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Internal Staff / Sales
    participant API as API Server
    participant DB as PostgreSQL DB
    actor Cust as Customer

    Staff->>API: Select Customer, Product, Variant (+₹560), Plan, Discount & Tax
    API->>DB: Save Quotation (Status: 'draft' / 'sent')
    Staff->>API: Click "Confirm & Create Subscription"
    API->>DB: Begin Transaction
    API->>DB: Update Quotation (Status: 'confirmed')
    API->>DB: Create Subscription (Status: 'active', Next Billing: Start Date)
    API->>DB: Create Subscription Line Items
    API->>DB: Commit Transaction
    API-->>Staff: Return Subscription #SUB-2026-000X
    Cust->>API: Open Customer Portal
    API-->>Cust: Displays Active Subscription & Renewal Dates
```

---

### Subscription Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft: Created by Staff / Quotation
    Draft --> Confirmed: Validated by Customer
    Confirmed --> Active: Activated on Start Date
    
    Active --> Paused: Staff / Customer Pause
    Paused --> Active: Resume Subscription
    
    Active --> Active: Renew Period (Next Billing Advanced)
    Active --> Expired: Current Date > Expiry Date (Auto-Job)
    
    Active --> Closed: Terminated by Admin / Staff
    Paused --> Closed: Terminated
    
    Expired --> [*]
    Closed --> [*]
```

---

### Idempotent Recurring Billing Engine

```mermaid
flowchart TD
    Start["Daily Billing Cron Job Triggered"] --> FetchDue["Find Subscriptions WHERE status = 'active' AND next_billing_date <= TODAY"]
    FetchDue --> CheckEmpty{"Any subscriptions due?"}
    CheckEmpty -- No --> Done["Log: 0 Invoices Generated"]
    CheckEmpty -- Yes --> LoopSubs["Iterate Over Each Due Subscription"]
    
    LoopSubs --> CheckDup{"SELECT id FROM invoices WHERE subscription_id = sub.id AND billing_period_start = sub.period_start"}
    CheckDup -- Exists --> Skip["Idempotency Protection:\nSkip Duplicate Creation"]
    CheckDup -- Does Not Exist --> Calc["Calculate Variant Charges + Apply Valid Discounts + Compute Taxes"]
    
    Calc --> GenerateInv["Generate Unique Invoice Number\n(INV-YYYY-XXXX)"]
    GenerateInv --> SaveInv["INSERT INTO invoices & invoice_items"]
    SaveInv --> AdvanceDate["Advance next_billing_date based on plan frequency\n(Daily/Weekly/Monthly/Yearly)"]
    AdvanceDate --> RecordLog["Record in automation_logs & audit_logs"]
    RecordLog --> SendEmail["Simulate Email Notification to Customer"]
    Skip --> NextSub["Next Subscription"]
    SendEmail --> NextSub
    NextSub --> LoopSubs
```

---

### Payment Reconciliation Workflow

```mermaid
flowchart LR
    Inv["Invoice #INV-2026-0001\nTotal: ₹13,338.72\nOutstanding: ₹13,338.72"] --> Pay1["Customer Pays Partial: ₹5,000 via UPI"]
    Pay1 --> Update1["Invoice Outstanding: ₹8,338.72\nStatus: 'confirmed' (Partial)"]
    Update1 --> Pay2["Customer Pays Remaining: ₹8,338.72 via Bank Transfer"]
    Pay2 --> Update2["Invoice Outstanding: ₹0.00\nStatus: 'paid' (Reconciled)"]
```

---

## 5. User Roles & Permission Matrix

| Capability / Module | Administrator | Internal Staff | Customer |
| :--- | :---: | :---: | :---: |
| **Analytics Dashboard (MRR, ARR, KPIs)** | ✅ Full Company | ✅ Full Company | 🔒 Self Only |
| **Create & Manage Products & Variants** | ✅ Yes | 👁️ View Only | ❌ No |
| **Configure Plans & Frequencies** | ✅ Yes | 👁️ View Only | ❌ No |
| **Configure Discount & Tax Rules** | ✅ Yes | 👁️ View Only | ❌ No |
| **Create & Manage Quotations** | ✅ Yes | ✅ Yes | 👁️ View Own |
| **Manage Subscriptions (Pause/Resume/Renew)** | ✅ Yes | ✅ Yes | 👁️ View Own |
| **Generate & Manage Invoices** | ✅ Yes | ✅ Yes | 👁️ View Own |
| **Download PDF Invoices** | ✅ Yes | ✅ Yes | ✅ Yes (Own Only) |
| **Record Payments (Cash, UPI, Card, Bank)** | ✅ Yes | ✅ Yes | ❌ No |
| **Create Staff & Admin Accounts** | ✅ Yes (Exclusive) | ❌ No | ❌ No |
| **Trigger Automation Jobs Manually** | ✅ Yes | ❌ No | ❌ No |
| **Inspect System Audit Logs** | ✅ Yes | ❌ No | ❌ No |

---

## 6. Core Feature Modules

### 1. Products & Variants Module
* **Base Product Management**: Products contain SKU, Type (Recurring Service / Software License / Hardware), Base Price, Cost Price, and Description.
* **Variant Pricing Calculations**: Create multi-variant attributes (e.g. Brand, Tier, Server Specs). If the user chooses the *Odoo Integration* variant, the formula automatically computes:
  $$\text{Final Price} = \text{Base Price} + \text{Variant Additional Price}$$
  $$\text{Final Price} = ₹12,000 + ₹560 = ₹12,560$$

### 2. Subscription Plans Module
* Configure plans with flexible billing frequencies: **Daily**, **Weekly**, **Monthly**, and **Yearly**.
* Minimum quantity requirements and availability date boundaries (start/end dates).
* Policy controls: Toggle whether plans allow manual pausing, customer renewal, or auto-closure.

### 3. Quotation Management Module
* Select customer, product, variant, plan, and quantity.
* Automatic discount application based on order value or minimum volume thresholds.
* Real-time tax computation preview.
* **1-Click Conversion**: Converting a quotation automatically provisions the active subscription and sets initial billing cycles without re-entering data.

### 4. Subscription Lifecycle Module
* Comprehensive state management: `draft` $\rightarrow$ `quotation` $\rightarrow$ `confirmed` $\rightarrow$ `active` $\rightarrow$ `paused` $\rightarrow$ `closed` $\rightarrow$ `expired`.
* Supports pausing subscriptions during off-seasons and seamless resumption.
* Next billing date auto-calculation engine based on calendar periods.

### 5. Idempotent Recurring Invoicing Module
* **Idempotency Guarantee**: Composite unique index (`subscription_id` + `billing_period_start`) ensures a recurring run never bills a customer twice for the same billing window.
* **Automated Line Items**: Calculates base, variant, discount, and tax lines.
* **PDF Export**: Generates printable and downloadable tax invoices using `jsPDF`.

### 6. Discount & Tax Engine
* **Flexible Discounts**: Supports both **Percentage Discounts** (e.g. 10% off) and **Fixed Discounts** (e.g. ₹500 off).
* **Usage Controls**: Maximum usage caps, active date ranges, and minimum spend rules.
* **Configurable Taxes**: Zero hardcoded rates. Dynamic GST, VAT, and Sales Tax rules configurable through the Admin UI.

### 7. Payment Tracking & Reconciliation
* Multi-method payment capture: **UPI**, **Bank Transfer**, **Credit/Debit Card**, **Cash**, and **Other**.
* Instant ledger reconciliation: Supports partial payments, computes outstanding balances, and marks invoices as `paid` when balance reaches ₹0.00.

### 8. Automation Hub
* **Recurring Billing Job**: Daily cron searches for due subscriptions, generates invoices, and advances billing dates.
* **7-Day Renewal Reminders**: Scans expiring subscriptions and fires email notifications before service disruption.
* **Overdue Detection**: Scans unpaid invoices past their due date and transitions their status to `overdue`.
* **Subscription Expiry**: Automatically flags subscriptions that have completed their term.

### 9. Analytics & KPI Dashboard
* Live financial metrics: **MRR (Monthly Recurring Revenue)**, **ARR (Annual Recurring Revenue)**, Total Invoiced, Collected, and Outstanding.
* Interactive visualizations: Monthly revenue bar charts, payment status breakdown donuts, and plan popularity rankings powered by Recharts.

---

## 7. Quick Demo Credentials & One-Click Switcher

For convenience during hackathon evaluation, the top navigation bar features a **One-Click Demo Persona Switcher**:

| Persona Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@brightloop.io` | `Password@123` | Full administrative control, team provisioning, financial rules, automation triggers |
| **Internal Staff** | `staff@brightloop.io` | `Password@123` | Quotations, subscriptions, customer records, payment logging |
| **Customer** | `customer@brightloop.io` | `Password@123` | Self-service portal, view own subscriptions, download invoices |

---

## 8. Local Setup & Installation Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [npm](https://www.npmjs.com/) (v9.0.0 or higher)
* [Git](https://git-scm.com/)

### Step 1: Clone the Repository
```bash
git clone https://github.com/tc484472-byte/odoo.git
cd odoo
```

### Step 2: Install Backend Dependencies
```bash
cd server
npm install --legacy-peer-deps
```

### Step 3: Install Frontend Dependencies
```bash
cd ../client
npm install
```

### Step 4: Environment Configuration (Optional)
The backend is equipped with zero-config in-memory PostgreSQL and automatic persistence. If you want to connect to a live Supabase or PostgreSQL instance, edit `server/.env`:
```env
PORT=5000
JWT_SECRET=super_secret_brightloop_odoo_jwt_key_2026
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
CLIENT_URL=http://localhost:5173
```
*(If `DATABASE_URL` is omitted, the system runs with the in-memory engine and persists snapshots to disk automatically).*

### Step 5: Start the Development Servers

**Terminal 1 — Backend API:**
```bash
cd server
npm start
# Server listens on http://localhost:5000
```

**Terminal 2 — Frontend Application:**
```bash
cd client
npm run dev
# Frontend live at http://localhost:5173
```

Visit `http://localhost:5173` in your browser.

---

## 9. Running the Automated Test Suite

The project includes an automated test harness covering all business logic, validation rules, financial reconciliation, and idempotency guarantees.

### Run Comprehensive Test Suite:
```bash
cd server
npm test
```

### Test Suite Execution Output:
```
===============================================================
🧪 RUNNING COMPREHENSIVE SUBSCRIPTION MANAGEMENT SYSTEM TESTS
===============================================================
[Suite 1: Validation & Security]
  ✅ PASS: Valid password accepted
  ✅ PASS: Short password rejected
  ✅ PASS: Password without uppercase rejected
  ✅ PASS: Password without lowercase rejected
  ✅ PASS: Password without special character rejected
  ✅ PASS: Valid email accepted
  ✅ PASS: Invalid email format rejected

[Suite 2: Role-Based Users & Customer Isolation]
  ✅ PASS: Admin account exists
  ✅ PASS: Staff account exists
  ✅ PASS: Customer accounts exist

[Suite 3: Product Variants & Price Calculations]
  ✅ PASS: Core product exists
  ✅ PASS: Odoo Brand variant exists
  ✅ PASS: Odoo Brand variant adds exactly ₹560
  ✅ PASS: Base (₹12,000) + Variant (₹560) = ₹12,560 calculated correctly

[Suite 4: Subscription Plans]
  ✅ PASS: Multiple plans configured
  ✅ PASS: Monthly plan available
  ✅ PASS: Yearly plan available

[Suite 5: Date & Period Calculations]
  ✅ PASS: Advance monthly adds 1 month
  ✅ PASS: Advance yearly adds 1 year
  ✅ PASS: Advance weekly adds 7 days
  ✅ PASS: Advance daily adds 1 day

[Suite 6: Recurring Billing Engine & Invoicing]
  ✅ PASS: Billing engine executed successfully

[Suite 7: Duplicate Invoice Prevention (Idempotency)]
  ✅ PASS: Second billing run executed without error
  ✅ PASS: Second run generated 0 new invoices (duplicate prevention active!)
  ✅ PASS: Subscription safely skipped because billing period was already invoiced

[Suite 8: Financial Calculations (Taxes & Discounts)]
  ✅ PASS: 10% discount on ₹12,560 is ₹1,256
  ✅ PASS: 18% GST on ₹11,304 is ₹2,034.72
  ✅ PASS: Final total is ₹13,338.72

[Suite 9: Payment Processing & Reconciliation]
  ✅ PASS: Partial payment correctly reduces outstanding balance
  ✅ PASS: Amount paid correctly updated

[Suite 10: Overdue Detection Engine]
  ✅ PASS: Overdue check completed without failure

[Suite 11: Renewal Reminders]
  ✅ PASS: Renewal reminders check completed without failure

[Suite 12: Subscription Lifecycle State Machine]
  ✅ PASS: Subscription transitioned from active to paused
  ✅ PASS: Subscription transitioned from paused to active

[Suite 13: Automation & Audit Logs]
  ✅ PASS: Automation execution logs recorded

===============================================================
🎉 TEST SUMMARY: 35 PASSED, 0 FAILED
===============================================================
```

### Run Issue Verification Suite:
```bash
node server/tests/verify_issues.js
# Verifies customer persistence, admin provisioning, and automation expiry check
```

---

## 10. REST API Specification

### Authentication & Users
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register customer account |
| `POST` | `/api/auth/login` | Public | Authenticate user & receive JWT token |
| `GET` | `/api/auth/me` | Authenticated | Fetch current profile & role |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset token |
| `POST` | `/api/auth/reset-password` | Public | Reset password with token |
| `GET` | `/api/users` | Admin | List team users (Admins & Staff) |
| `POST` | `/api/users` | Admin | Create new Administrator or Staff account |
| `PATCH` | `/api/users/:id/status` | Admin | Activate or deactivate team account |

### Customers
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customers` | Staff, Admin, Customer | List customers (isolated for customer role) |
| `GET` | `/api/customers/:id` | Staff, Admin, Customer | Customer details with invoices & subscriptions |
| `POST` | `/api/customers` | Staff, Admin | Create customer & auto-provision user login |
| `PUT` | `/api/customers/:id` | Staff, Admin | Update customer details & GSTIN |

### Products & Plans
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | All Roles | List products and variant prices |
| `POST` | `/api/products` | Admin | Create product with base price |
| `POST` | `/api/products/:id/variants`| Admin | Add variant with additional price (+₹560) |
| `GET` | `/api/plans` | All Roles | List active subscription plans |
| `POST` | `/api/plans` | Admin | Create plan (Daily/Weekly/Monthly/Yearly) |

### Quotations & Subscriptions
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/quotations` | All Roles | List quotations (isolated for customer) |
| `POST` | `/api/quotations` | Staff, Admin | Create quotation with items, taxes, discounts |
| `POST` | `/api/quotations/:id/confirm` | Staff, Admin | Confirm quotation and auto-create subscription |
| `GET` | `/api/subscriptions` | All Roles | List subscriptions with status filters |
| `PATCH` | `/api/subscriptions/:id/status`| Staff, Admin | Transition state (pause / resume / close) |
| `POST` | `/api/subscriptions/:id/renew` | Staff, Admin | Manually trigger renewal cycle |

### Invoices & Payments
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices` | All Roles | List invoices (isolated for customer) |
| `GET` | `/api/invoices/:id` | All Roles | Full invoice details and line items |
| `GET` | `/api/payments` | Staff, Admin | List payment ledger records |
| `POST` | `/api/payments` | Staff, Admin | Record payment (Cash, UPI, Card, Bank) |

### Automation & Analytics
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard` | All Roles | Retrieve live MRR, ARR, KPIs, charts |
| `POST` | `/api/automation/billing-run` | Admin | Trigger recurring billing engine on demand |
| `POST` | `/api/automation/overdue-check` | Admin | Trigger overdue invoice detection |
| `POST` | `/api/automation/renewal-reminders` | Admin | Send 7-day renewal reminder notifications |
| `POST` | `/api/automation/expiry-check` | Admin | Scan and update expired subscriptions |
| `GET` | `/api/automation/logs` | Admin | Review background scheduler execution logs |

---

## 11. Free-Tier Production Deployment Guide

The architecture is specifically engineered to deploy at zero cost using free cloud tiers:

### 1. Database: Supabase (Free Tier PostgreSQL)
1. Create a free account at [Supabase](https://supabase.com).
2. Create a new project and navigate to **Project Settings $\rightarrow$ Database**.
3. Copy the **Connection String (URI)** (e.g. `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`).
4. Run the schema file [`server/migrations/schema.sql`](server/migrations/schema.sql) in Supabase's SQL Editor.

### 2. Backend: Render (Free Tier Web Service)
1. Create a free account at [Render](https://render.com).
2. Create a **New Web Service** connected to your GitHub repository `https://github.com/tc484472-byte/odoo.git`.
3. Set the following parameters:
   * **Root Directory**: `server`
   * **Build Command**: `npm install --legacy-peer-deps`
   * **Start Command**: `npm start`
4. Add Environment Variables:
   * `DATABASE_URL`: Your Supabase connection string.
   * `JWT_SECRET`: A long random secret string.
   * `NODE_ENV`: `production`
   * `CLIENT_URL`: Your frontend Vercel URL.

### 3. Frontend: Vercel (Free Tier Hosting)
1. Create a free account at [Vercel](https://vercel.com).
2. Import the GitHub repository `https://github.com/tc484472-byte/odoo.git`.
3. Set the **Root Directory** to `client`.
4. Add the Environment Variable:
   * `VITE_API_URL`: Your deployed Render backend URL (e.g. `https://brightloop-api.onrender.com/api`).
5. Click **Deploy**. Vercel will build and serve the application globally via its CDN.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

---
*Built with ❤️ for the Odoo Hackathon by Brightloop Software Solutions.*
