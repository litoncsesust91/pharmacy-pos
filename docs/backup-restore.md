# Backup And Restore

## Backup

Create an encrypted custom-format PostgreSQL backup daily and before migrations:

```bash
pg_dump --format=custom --no-owner --file=pharmacy-pos-$(date +%F).dump "$DATABASE_URL"
openssl enc -aes-256-cbc -pbkdf2 -salt -in pharmacy-pos-$(date +%F).dump -out pharmacy-pos-$(date +%F).dump.enc
```

Store encrypted backups outside the database host with a retention policy approved by the tenant and compliance owner. Never commit backups or encryption keys.

## Restore Test

```bash
createdb pharmacy_pos_restore
openssl enc -d -aes-256-cbc -pbkdf2 -in pharmacy-pos-YYYY-MM-DD.dump.enc -out pharmacy-pos-YYYY-MM-DD.dump
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" pharmacy-pos-YYYY-MM-DD.dump
npm run db:migrate --workspace @pharmacy-pos/api -- --deploy
```

Verify tenant login, a report, an inventory query, and a test sale in the isolated restore environment. Record restore duration, backup age, and row-count checks.
