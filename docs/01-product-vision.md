# 01 Product Vision

## Vision Statement
Give any software team a fast, self-hostable agile workspace that feels as clean as Linear
and as capable as Jira — without per-seat lock-in.

## Problem
Teams either outgrow lightweight tools (no sprints, no reports, no RBAC) or drown in
heavyweight ones (slow, over-configured, expensive). Both make day-to-day task tracking a
chore and hide the signal — what's in this sprint, who's overloaded, are we on track.

## Why Now
Small teams increasingly want to own their tooling and data. A modern React/Next.js +
MongoDB stack makes it realistic to ship a polished, real-time-feeling agile board that a
team can run themselves and extend.

## Non-Goals
- Not a full project-portfolio / resource-planning suite (no Gantt dependencies engine, no billing).
- Not a document/wiki product (no Confluence-style pages).
- Not real-time collaborative editing (no OT/CRDT); updates are request/response + polling.
- No native mobile apps in V1 (responsive web only).
