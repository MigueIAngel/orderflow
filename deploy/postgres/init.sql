-- Database-per-service: one PostgreSQL server, one database (and owner) per service.
-- No service can read another service's tables; they only share events.
CREATE DATABASE orders;
CREATE DATABASE inventory;
CREATE DATABASE payments;
