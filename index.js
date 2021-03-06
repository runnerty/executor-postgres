'use strict';

const pg = require('pg');
const pgCopy = require('pg-copy-streams');
const QueryStream = require('pg-query-stream');
const JSONStream = require('JSONStream');
const Excel = require('exceljs');
const csv = require('fast-csv');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const Executor = require('@runnerty/module-core').Executor;

class postgresExecutor extends Executor {
  constructor(process) {
    super(process);
    this.ended = false;
    this.endOptions = {
      end: 'end'
    };
  }

  async exec(params) {
    // MAIN:
    try {
      if (!params.command) {
        if (params.command_file) {
          // Load SQL file:
          try {
            await fsp.access(params.command_file, fs.constants.F_OK | fs.constants.W_OK);
            params.command = await fsp.readFile(params.command_file, 'utf8');
          } catch (err) {
            throw new Error(`Load SQLFile: ${err}`);
          }
        } else {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = 'execute-postgres dont have command or command_file';
          this.endOptions.err_output = 'execute-postgres dont have command or command_file';
          this._end(this.endOptions);
        }
      }
      const query = await this.prepareQuery(params);
      this.endOptions.command_executed = query;

      const connectionOptions = {
        user: params.user,
        host: params.host,
        database: params.database,
        password: params.password,
        port: params.port,
        application_name: params.application_name || 'runnerty',
        connectionTimeoutMillis: params.connectionTimeoutMillis || 60000,
        query_timeout: params.query_timeout || false,
        statement_timeout: params.statement_timeout || false,
        idle_in_transaction_session_timeout: params.idle_in_transaction_session_timeout || false,
        keepAlive: params.keepAlive || false,
        keepAliveInitialDelayMillis: params.keepAliveInitialDelayMillis || 0,
        encoding: params.encoding || 'utf8'
      };

      //SSL
      if (params.ssl) {
        try {
          if (params.ssl.ca) params.ssl.ca = fs.readFileSync(params.ssl.ca);
          if (params.ssl.cert) params.ssl.cert = fs.readFileSync(params.ssl.cert);
          if (params.ssl.key) params.ssl.key = fs.readFileSync(params.ssl.key);
          connectionOptions.ssl = params.ssl;
        } catch (error) {
          this.endOptions.end = 'error';
          this.endOptions.messageLog = `execute-postgres reading ssl file/s: ${error}`;
          this.endOptions.err_output = `execute-postgres reading ssl file/s: ${error}`;
          this._end(this.endOptions);
        }
      }

      const pool = new pg.Pool(connectionOptions);

      pool.on('error', err => {
        this.endOptions.end = 'error';
        this.endOptions.messageLog = `execute-postgres: ${err}`;
        this.endOptions.err_output = `execute-postgres: ${err}`;
        this._end(this.endOptions);
      });

      const client = await pool.connect();

      if (params.localInFile) await this.executeCopyFrom(client, query, params);
      if (params.fileExport) await this.executeCopyTo(client, query, params);
      if (params.jsonFileExport) await this.queryToJSON(client, query, params);
      if (params.xlsxFileExport) await this.queryToXLSX(client, query, params);
      if (params.csvFileExport) await this.queryToCSV(client, query, params);
      if (
        !params.localInFile &&
        !params.fileExport &&
        !params.jsonFileExport &&
        !params.xlsxFileExport &&
        !params.csvFileExport
      )
        await this.executeQuery(client, query);
    } catch (error) {
      this.error(error);
    }
  }

  // Query to DATA_OUTPUT:
  async executeQuery(client, query) {
    try {
      const results = await client.query(query);
      this.prepareEndOptions(results.rows[0], results.rowCount, results.rows);
      this._end(this.endOptions);
      client.release();
    } catch (err) {
      this.error(err, client);
    }
  }
  // COPY to plane file:
  async executeCopyTo(client, query, params) {
    try {
      const resStream = client.query(pgCopy.to(query));
      const fileStreamWriter = fs.createWriteStream(params.fileExport);
      fileStreamWriter.on('error', error => {
        this.error(error, client);
      });
      fileStreamWriter.on('finish', () => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        client.release();
      });
      resStream.on('error', error => {
        this.error(error, client);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });
      resStream.pipe(fileStreamWriter);
    } catch (error) {
      this.error(error, client);
    }
  }

  // Query to JSON:
  async queryToJSON(client, query, params) {
    try {
      await fsp.access(path.dirname(params.jsonFileExport));
      const queryStream = new QueryStream(query);
      const resStream = client.query(queryStream);
      const fileStreamWriter = fs.createWriteStream(params.jsonFileExport);
      fileStreamWriter.on('error', error => {
        this.error(error, client);
      });
      fileStreamWriter.on('finish', () => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        client.release();
      });
      resStream.on('error', error => {
        this.error(error, client);
      });
      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });

      resStream.pipe(JSONStream.stringify()).pipe(fileStreamWriter);
    } catch (err) {
      this.error(err, client);
    }
  }

  // Query to XLSX:
  async queryToXLSX(client, query, params) {
    try {
      await fsp.access(path.dirname(params.xlsxFileExport));
      const queryStream = new QueryStream(query);
      const resStream = client.query(queryStream);
      const fileStreamWriter = fs.createWriteStream(params.xlsxFileExport);

      const options = {
        stream: fileStreamWriter,
        useStyles: true,
        useSharedStrings: true
      };
      const workbook = new Excel.stream.xlsx.WorkbookWriter(options);

      const author = 'Runnerty';
      const sheetName = 'Sheet';
      const sheet = workbook.addWorksheet(params.xlsxSheetName ? params.xlsxSheetName : sheetName);
      workbook.creator = params.xlsxAuthorName ? params.xlsxAuthorName : author;

      workbook.lastPrinted = new Date();

      fileStreamWriter.on('error', error => {
        this.error(error, client);
      });
      resStream.on('error', error => {
        this.error(error, client);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          sheet.columns = this.generateHeader(row);
          isFirstRow = false;
        }
        sheet.addRow(row).commit();
        rowCounter++;
      });

      resStream.on('end', async () => {
        await workbook.commit();
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        client.release();
      });
    } catch (err) {
      this.error(err, client);
    }
  }

  // Query to CSV:
  async queryToCSV(client, query, params) {
    try {
      await fsp.access(path.dirname(params.csvFileExport));
      const queryStream = new QueryStream(query);
      const resStream = client.query(queryStream);
      const fileStreamWriter = fs.createWriteStream(params.csvFileExport);

      const paramsCSV = params.csvOptions || {};
      if (!paramsCSV.hasOwnProperty('headers')) paramsCSV.headers = true;
      const csvStream = csv.format(paramsCSV).on('error', err => {
        this.error(err, client);
      });

      fileStreamWriter.on('error', error => {
        this.error(error, client);
      });
      resStream.on('error', error => {
        this.error(error, client);
      });

      // STREAMED
      let isFirstRow = true;
      let firstRow = {};
      let rowCounter = 0;
      resStream.on('data', row => {
        if (isFirstRow) {
          firstRow = row;
          isFirstRow = false;
        }
        rowCounter++;
      });

      resStream.on('end', async data => {
        this.prepareEndOptions(firstRow, rowCounter);
        this._end(this.endOptions);
        client.release();
      });

      resStream.pipe(csvStream).pipe(fileStreamWriter);
    } catch (err) {
      this.error(err, client);
    }
  }

  // COPY FROM - LOAD DATA:
  async executeCopyFrom(client, query, params) {
    try {
      await fsp.access(params.localInFile);
      const resStream = await client.query(pgCopy.from(query));
      const fileStreamReader = fs.createReadStream(params.localInFile);
      fileStreamReader.on('error', error => {
        this.error(error, client);
      });
      resStream.on('error', error => {
        this.error(error, client);
      });
      resStream.on('finish', () => {
        fileStreamReader.end();
        this._end(this.endOptions);
        client.release();
      });
      fileStreamReader.pipe(resStream);
    } catch (error) {
      this.error(error, client);
    }
  }

  error(err, client) {
    if (client) client.release();
    this.endOptions.end = 'error';
    this.endOptions.messageLog = `execute-postgres: ${err}`;
    this.endOptions.err_output = `execute-postgres: ${err}`;
    this._end(this.endOptions);
  }

  _end(endOptions) {
    if (!this.ended) this.end(endOptions);
    this.ended = true;
  }

  async prepareQuery(values) {
    const options = {
      useExtraValue: values.args || false,
      useProcessValues: true,
      useGlobalValues: true,
      altValueReplace: 'null'
    };

    try {
      const query = await this.paramsReplace(values.command, options);
      return query;
    } catch (err) {
      throw err;
    }
  }

  generateHeader(row) {
    const columns = [];
    for (let i = 0; i < Object.keys(row).length; i++) {
      columns.push({
        header: Object.keys(row)[i],
        key: Object.keys(row)[i],
        width: 30
      });
    }
    return columns;
  }

  prepareEndOptions(firstRow, rowCounter, results) {
    //STANDARD OUPUT:
    this.endOptions.data_output = results || '';

    //EXTRA DATA OUTPUT:
    this.endOptions.extra_output = {};
    this.endOptions.extra_output.db_countrows = rowCounter || '0';

    this.endOptions.extra_output.db_firstRow = JSON.stringify(firstRow);
    if (firstRow instanceof Object) {
      const keys = Object.keys(firstRow);
      let keysLength = keys.length;
      while (keysLength--) {
        const key = keys[keysLength];
        this.endOptions.extra_output['db_firstRow_' + key] = firstRow[key];
      }
    }
  }
}

module.exports = postgresExecutor;
