// Drizzle schema — type-only mirror of supabase/migrations/0001_init.sql.
// We do NOT use drizzle-kit to manage migrations; the SQL files are the
// source of truth. This file exists for compile-time query types only.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  time,
  integer,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    authUserId: uuid("auth_user_id"),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["parent", "child"] }).notNull(),
    avatarColor: text("avatar_color").notNull(),
    birthdate: date("birthdate"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    householdIdx: index("users_household_idx").on(t.householdId),
  }),
);

export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("🧹"),
    expectedCadenceDays: integer("expected_cadence_days").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    householdIdx: index("areas_household_idx").on(t.householdId),
  }),
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    areaId: uuid("area_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    expectedDurationMinutes: integer("expected_duration_minutes")
      .notNull()
      .default(15),
    expectedCadenceDays: integer("expected_cadence_days"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    householdIdx: index("task_templates_household_idx").on(t.householdId),
    areaIdx: index("task_templates_area_idx").on(t.areaId),
  }),
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    templateIdx: index("checklist_items_template_idx").on(t.templateId),
  }),
);

export const taskSchedules = pgTable(
  "task_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    templateId: uuid("template_id").notNull(),
    rruleString: text("rrule_string"),
    assignmentPolicy: text("assignment_policy", {
      enum: ["fixed", "round_robin", "load_balanced"],
    })
      .notNull()
      .default("fixed"),
    assigneeUserIds: uuid("assignee_user_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    lastAssignedUserId: uuid("last_assigned_user_id"),
    nextOccurrences: date("next_occurrences")
      .array()
      .notNull()
      .default(sql`'{}'::date[]`),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    householdIdx: index("task_schedules_household_idx").on(t.householdId),
    templateIdx: index("task_schedules_template_idx").on(t.templateId),
  }),
);

export const taskInstances = pgTable(
  "task_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id").notNull(),
    templateId: uuid("template_id").notNull(),
    scheduleId: uuid("schedule_id"),
    scheduledFor: date("scheduled_for").notNull(),
    assignedUserId: uuid("assigned_user_id").notNull(),
    status: text("status", {
      enum: ["pending", "in_progress", "completed", "skipped"],
    })
      .notNull()
      .default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: uuid("completed_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    householdDayIdx: index("task_instances_household_day_idx").on(
      t.householdId,
      t.scheduledFor,
    ),
    assigneeDayStatusIdx: index("task_instances_assignee_day_status_idx").on(
      t.assignedUserId,
      t.scheduledFor,
      t.status,
    ),
  }),
);

export const checklistCompletions = pgTable(
  "checklist_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id").notNull(),
    checklistItemId: uuid("checklist_item_id").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    checkedByUserId: uuid("checked_by_user_id").notNull(),
  },
  (t) => ({
    instanceIdx: index("checklist_completions_instance_idx").on(t.instanceId),
    uniqInstanceItem: uniqueIndex("checklist_completions_instance_item_uniq").on(
      t.instanceId,
      t.checklistItemId,
    ),
  }),
);

export const areaState = pgTable("area_state", {
  areaId: uuid("area_id").primaryKey(),
  lastCleanedAt: timestamp("last_cleaned_at", { withTimezone: true }),
  dirtLevel: integer("dirt_level").notNull().default(4),
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({ userIdx: index("push_subscriptions_user_idx").on(t.userId) }),
);

export const reminderLog = pgTable(
  "reminder_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    instanceId: uuid("instance_id").notNull(),
    userId: uuid("user_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind", { enum: ["morning", "evening"] }).notNull(),
    slotDate: date("slot_date").notNull(),
  },
  (t) => ({
    userIdx: index("reminder_log_user_idx").on(t.userId, t.slotDate),
    uniq: uniqueIndex("reminder_log_uniq").on(
      t.instanceId,
      t.userId,
      t.kind,
      t.slotDate,
    ),
  }),
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  morningReminderTime: time("morning_reminder_time").notNull().default("09:00"),
  eveningReminderTime: time("evening_reminder_time").notNull().default("18:00"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Household = typeof households.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type TaskSchedule = typeof taskSchedules.$inferSelect;
export type TaskInstance = typeof taskInstances.$inferSelect;
export type ChecklistCompletion = typeof checklistCompletions.$inferSelect;
export type AreaState = typeof areaState.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type ReminderLog = typeof reminderLog.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
