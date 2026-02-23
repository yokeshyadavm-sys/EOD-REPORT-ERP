# Supabase Setup for ERP Task Manager

## 1. Create your Supabase Table
Open your project at [app.supabase.com](https://app.supabase.com), go to the **SQL Editor**, paste the following, and click **RUN**:

```sql
create extension if not exists "uuid-ossp";

-- Create Table
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- "Assign To" / Owner of task
  title text not null,
  description text,
  created_date date not null,
  due_date date,
  assigned_by text,                   -- Current user who assigned it
  status text default 'Active',       -- Active | Inprogress | Completed
  comments text,
  completed_date date
);

-- Disable Row Level Security (Only do this for fast prototyping / private backends. Otherwise configure properly)
alter table public.tasks disable row level security;
```

## 2. Fill in your Credentials
1. In your Supabase Dashboard, go to **Project Settings** (Gear icon on bottom left).
2. Go to **API**.
3. Copy your `Project URL` and `anon public` Key.
4. Open the `script.js` file and replace the Placeholders at line 3 and 4 with your actual URL and Key:
   ```javascript
   const SUPABASE_URL = 'https://abcxyz.supabase.co';
   const SUPABASE_KEY = 'eyJhbGciOiJIUzI...';
   ```

## 3. Play!
You are completely done! Everything is now connected. Load the project and create some tasks!
