# Postgres executor for [Runnerty]:

### Configuration sample:
```json
{
  "id": "postgres_default",
  "type": "@runnerty-executor-postgres",
  "user": "postgresusr",
  "password": "postgrespass",
  "host":"myhost.com",
  "database": "MYDB",
  "port": "5439"
}
```

### Plan sample:
```json
{
  "id":"postgres_default",
  "command_file": "/etc/runnerty/sql/test.sql"
}
```

```json
{
  "id":"postgres_default",
  "command": "SELECT now();"
}
```
### Output (Process values):
#### Standard
* `PROCESS_EXEC_ERR_OUTPUT`: Error output message.
#### Query output
* `PROCESS_EXEC_DATA_OUTPUT`: Postgres query output data.
* `PROCESS_EXEC_DB_COUNTROWS`: Postgres query count rows.
* `PROCESS_EXEC_DB_FIRSTROW`: Postgres query first row data.
* `PROCESS_EXEC_DB_FIRSTROW_[FILED_NAME]`: Postgres first row field data.
#### Operation output
* `PROCESS_EXEC_DB_FIELDCOUNT`: Postgres field count.
* `PROCESS_EXEC_DB_INSERTID`: Postgres insert ID.

[Runnerty]: http://www.runnerty.io
