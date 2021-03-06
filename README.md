<p align="center">
  <a href="http://runnerty.io">
    <img height="257" src="https://runnerty.io/assets/header/logo-stroked.png">
  </a>
  <p align="center">Smart Processes Management</p>
</p>

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Dependency Status][david-badge]][david-badge-url]
<a href="#badge">
<img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg">
</a>

# PostgreSQL executor for [Runnerty]:

### Installation:

Through NPM

```bash
npm i @runnerty/executor-postgres
```

You can also add modules to your project with [runnerty-cli]

```bash
npx runnerty-cli add @runnerty/executor-postgres
```

This command installs the module in your project, adds example configuration in your `config.json` and creates an example plan of use.

If you have installed [runnerty-cli] globally you can include the module with this command:

```bash
rty add @runnerty/executor-postgres
```

### Configuration:

Add in [config.json]:

```json
{
  "id": "postgres_default",
  "type": "@runnerty-executor-postgres",
  "user": "postgresusr",
  "password": "postgrespass",
  "database": "MYDB",
  "host": "myhost.com",
  "port": "5432"
}
```

```json
{
  "id": "postgres_default",
  "type": "@runnerty-executor-postgres",
  "user": "postgresusr",
  "password": "postgrespass",
  "database": "MYDB",
  "host": "myhost.com",
  "port": "5432",
  "ssl": {
    "ca": "./ssl/my.ca"
  }
}
```

#### Configuration params:

| Parameter                           | Description                                                 |
| :---------------------------------- | :---------------------------------------------------------- |
| user                                | The postgres user to authenticate as.                       |
| password                            | The password of that postgres user.                         |
| database                            | Name of the database to use for this connection. (Optional) |
| host                                | The hostname of the database you are connecting to.         |
| port                                | The port number to connect to. (Default: 3306)              |
| encoding                            | The encoding for the connection. (Default: 'utf8')          |
| application_name                    | (Default: runnerty)                                         |
| connectionTimeoutMillis             | (Default: 60000)                                            |
| query_timeout                       | (Default: false)                                            |
| statement_timeout                   | (Default: false)                                            |
| idle_in_transaction_session_timeout | (Default: false)                                            |
| keepAlive                           | (Default: false)                                            |
| keepAliveInitialDelayMillis         | (Default: 0)                                                |
| ssl/ca                              | SSL CA File (Optional)                                      |
| ssl/cert                            | SSL CERT File (Optional)                                    |
| ssl/key                             | SSL KEY File (Optional)                                     |

### Plan sample:

Add in [plan.json]:

```json
{
  "id": "postgres_default",
  "command_file": "./sql/test.sql"
}
```

```json
{
  "id": "postgres_default",
  "command": "SELECT * FROM generate_series(1,10)"
}
```

### Generation of files:

The saved can be indicated in the file of the results obtained from a query in csv, xlsx and json format. These files will be generated with streams.
You only have to indicate the corresponding property in the parameters:

#### XLSX

XLSX Format

| Parameter      | Description                   |
| :------------- | :---------------------------- |
| xlsxFileExport | Path of xlsx file export.     |
| xlsxAuthorName | Author file name. (Optional)  |
| xlsxSheetName  | Name of the sheet. (Optional) |

Sample:

```json
{
  "id": "postgres_default",
  "command": "SELECT * FROM USERS",
  "xlsxFileExport": "./my_output.xlsx",
  "xlsxAuthorName": "Runnerty",
  "xlsxSheetName": "MySheetSample"
}
```

#### CSV

CSV Format

| Parameter                         | Description                                                                                                                                                                             |
| :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| csvFileExport                     | Path of csv file export.                                                                                                                                                                |
| csvOptions/headers                | Type: boolean/string[]. The headers will be auto detected from the first row or you can to provide headers array: ['h1name','h2name',...].                                              |
| csvOptions/delimiter              | Alternate delimiter. (Default: ',')                                                                                                                                                     |
| csvOptions/quote                  | Alternate quote. (Default: '"')                                                                                                                                                         |
| csvOptions/alwaysWriteHeaders     | Set to true if you always want headers written, even if no rows are written. (Default: false)                                                                                           |
| csvOptions/rowDelimiter           | Specify an alternate row delimiter (i.e \r\n). (Default: '\n')                                                                                                                          |
| csvOptions/quoteHeaders           | If true then all headers will be quoted. (Default: quoteColumns value)                                                                                                                  |
| csvOptions/quoteColumns           | If true then columns and headers will be quoted (unless quoteHeaders is specified). (Default: false). More info [here.](https://c2fo.io/fast-csv/docs/formatting/options/#quotecolumns) |
| csvOptions/escape                 | Alternate escaping value. (Default: '"')                                                                                                                                                |
| csvOptions/includeEndRowDelimiter | Set to true to include a row delimiter at the end of the csv. (Default: false)                                                                                                          |
| csvOptions/writeBOM               | Set to true if you want the first character written to the stream to be a utf-8 BOM character. (Default: false)                                                                         |

Sample:

```json
{
  "id": "postgres_default",
  "command": "SELECT * FROM USERS",
  "csvFileExport": "@GV(WORK_DIR)/users.csv",
  "csvOptions": {
    "delimiter": ";",
    "quote": "\""
  }
}
```

#### JSON

JSON Format

Sample:

```json
{
  "id": "postgres_default",
  "command": "SELECT * FROM USERS",
  "jsonfileExport": "@GV(WORK_DIR)/users.json"
}
```

#### PLAIN FILE

Plain File Format

For very large data exports it is recommended to use `COPY TO` with `fileExport` instead of `csvFileExport`, despite being developed on streams, it can save the work of converting to CSV.

Sample:

```json
{
  "id": "postgres_default",
  "command": "COPY persons TO STDOUT DELIMITER ';' CSV HEADER QUOTE '\"';",
  "fileExport": "./users.csv"
}
```

### Loading files (COPY FROM)

For file upload you must indicate the path of the file to be loaded in the `localInFile` parameter and in the `COPY [...] FROM` statement you must indicate `STDIN`. For example:

- `localInFile`: CSV file path

```json
{
  "id": "postgres_default",
  "command": "COPY persons (first_name,last_name,email) FROM STDIN DELIMITER ';' CSV HEADER QUOTE '\"';",
  "localInFile": "/persons_to_import.csv"
}
```

### Output (Process values):

#### Standard

- `PROCESS_EXEC_MSG_OUTPUT`: postgres output message.
- `PROCESS_EXEC_ERR_OUTPUT`: Error output message.

#### Query output

- `PROCESS_EXEC_DATA_OUTPUT`: postgres query output data.
- `PROCESS_EXEC_DB_COUNTROWS`: postgres query count rows.
- `PROCESS_EXEC_DB_FIRSTROW`: postgres query first row data.
- `PROCESS_EXEC_DB_FIRSTROW_[FILED_NAME]`: postgres first row field data.

[runnerty]: http://www.runnerty.io
[downloads-image]: https://img.shields.io/npm/dm/@runnerty/executor-postgres.svg
[npm-url]: https://www.npmjs.com/package/@runnerty/executor-postgres
[npm-image]: https://img.shields.io/npm/v/@runnerty/executor-postgres.svg
[david-badge]: https://david-dm.org/runnerty/executor-postgres.svg
[david-badge-url]: https://david-dm.org/runnerty/executor-postgres
[config.json]: http://docs.runnerty.io/config/
[runnerty-cli]: https://www.npmjs.com/package/runnerty-cli
[plan.json]: http://docs.runnerty.io/plan/
