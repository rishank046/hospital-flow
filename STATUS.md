# MediQ Implementation Status

This file is a living checklist. AI agents should update it only after the relevant implementation and tests actually exist.

## Foundation

- [x] PostgreSQL schema designed
- [x] Database schema applied to development database
- [x] Environment configuration documented
- [x] Health check endpoint
- [x] Global error handler

## Authentication / authorization

- [x] Single login endpoint
- [x] Password hashing
- [x] JWT issuance
- [x] JWT verification middleware
- [x] `request.user` typing
- [x] Account-role authorization
- [x] Staff-role authorization
- [x] Admin staff-management authorization
- [x] Patient ownership authorization

## User / patient

- [x] User registration
- [x] Current-user endpoint
- [x] Create patient profile
- [x] List owned patients
- [x] Update owned patient
- [ ] Walk-in patient registration by OPD staff
- [x] Patient ownership linking rules

## Staff / admin

- [x] Admin creates staff account
- [x] Admin assigns staff role
- [x] Admin assigns department
- [x] Admin activates/deactivates staff
- [x] Doctor profile management
- [x] OPD Manager access

## OPD

- [ ] Walk-in registration
- [ ] Department selection
- [ ] Doctor assignment
- [ ] Visit creation
- [ ] OPD queue entry
- [ ] Token generation policy

## Appointments

- [ ] Doctor availability endpoint
- [ ] Appointment creation
- [ ] Appointment conflict protection
- [ ] Appointment cancellation
- [ ] Check-in
- [ ] Appointment-to-visit transition
- [x] Dynamic estimated wait

## Doctor

- [x] Doctor queue endpoint
- [x] Call patient
- [x] Skip patient
- [ ] Start consultation
- [ ] Save consultation
- [ ] Complete consultation
- [ ] Create prescription
- [ ] Create investigation order

## Workflow

- [x] Create workflow tasks
- [x] Create task dependencies
- [x] Block dependent task
- [x] Complete task
- [x] Unblock dependent task atomically
- [x] Prevent invalid transitions

## Laboratory

- [ ] Lab queue
- [ ] Accept/claim lab task
- [ ] Sample collection
- [ ] Test processing
- [ ] Result entry
- [ ] Result verification/publication
- [ ] Patient report access
- [ ] Doctor report access

## Pharmacy

- [ ] Pharmacy queue
- [ ] Pharmacy task activation after dependencies
- [ ] View prescription
- [ ] Dispense medication
- [ ] Complete pharmacy task

## Billing / payments

- [x] Generate invoice
- [x] Invoice items
- [ ] Online payment initialization abstraction
- [ ] QR/checkout payload
- [ ] Payment confirmation
- [x] Cash counter queue
- [x] Cash payment completion
- [x] Invoice paid calculation

## Notifications

- [ ] In-app notifications table integration
- [ ] Queue update notifications
- [ ] Appointment notifications
- [ ] Lab notifications
- [ ] Pharmacy notifications
- [ ] Billing notifications
- [ ] Read/unread state
- [ ] SMS/WhatsApp integration — intentionally deferred

## WebSockets

- [ ] Project owner implementation — intentionally deferred from AI coding

## Testing

- [x] Auth tests
- [x] Authorization tests
- [x] Patient ownership tests
- [x] Appointment conflict tests
- [x] Queue tests
- [x] Workflow dependency tests
- [ ] Lab flow tests
- [ ] Pharmacy flow tests
- [x] Billing/payment tests

## Deployment

- [x] Development database verified
- [ ] Production database configured
- [ ] API deployment
- [ ] Frontend deployment
- [ ] Environment variables documented
