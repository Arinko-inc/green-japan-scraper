import fs from 'fs';

class Logger {
  constructor(logFile = 'debug.log') {
    this.logFile = logFile;
    this.logs = [];
    this.startTime = null;
    this._writeHeader();
  }

  _getTime() {
    return new Date().toISOString().replace('T', ' ').substring(0, 23);
  }

  _getElapsed() {
    if (!this.startTime) return '00:00:00.000';
    const diff = new Date() - this.startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const ms = diff % 1000;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '.' + String(ms).padStart(3,'0');
  }

  _writeHeader() {
    const header = [
      '=== SCRAPING DEBUG LOG ===',
      'Started: ' + new Date().toISOString(),
      'Working Dir: ' + process.cwd(),
      '',
      '---'
    ].join('\n');
    this.logs.push(header);
    fs.writeFileSync(this.logFile, header + '\n\n');
  }

  log(level, msg, data = null) {
    const elapsed = this._getElapsed();
    let entry = '[' + elapsed + '] [' + level + '] ' + msg;
    if (data !== null) {
      try {
        const str = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
        entry += '\n    Data: ' + str.substring(0, 500) + (str.length > 500 ? '...' : '');
      } catch (e) {
        entry += '\n    Data: [serialization error]';
      }
    }
    this.logs.push(entry);
    console.log(entry);
    fs.appendFileSync(this.logFile, entry + '\n\n');
  }

  start() {
    this.startTime = new Date();
    this.log('INFO', '=== START ===');
  }

  stop() {
    this.log('INFO', '=== STOP ===');
    this.log('INFO', 'Elapsed: ' + this._getElapsed());
    this.log('INFO', 'Log entries: ' + this.logs.length);
  }

  info(msg, data) { this.log('INFO', msg, data); }
  warn(msg, data) { this.log('WARN', msg, data); }
  debug(msg, data) { this.log('DEBUG', msg, data); }

  error(msg, err) {
    let m = msg;
    if (err instanceof Error) {
      m += '\n    Error: ' + err.name;
      m += '\n    Stack: ' + (err.stack ? err.stack.split('\n')[1].trim() : 'N/A');
    }
    this.log('ERROR', m);
  }

  http(method, url, status, duration) {
    let m = 'HTTP ' + method + ' ' + url;
    if (status) m += ' [status=' + status + ']';
    if (duration) m += ' [' + duration + 'ms]';
    this.log('HTTP', m);
  }

  pageLoad(url, status, duration) {
    this.log('PAGE', 'Loaded: ' + url, { status, duration: duration + 'ms' });
  }

  elementFound(selector, count) {
    this.log('ELEMENT', count + ' element(s) found: ' + selector);
  }

  elementNotFound(selector) {
    this.log('WARN', 'No element found: ' + selector);
  }

  scrapeStart(url) {
    this.log('SCRAP', 'Scrape started: ' + url);
  }

  scrapeItem(idx, total, title) {
    const t = title ? title.substring(0, 50) : 'N/A';
    this.log('SCRAP', '[' + (idx+1) + '/' + total + '] ' + t);
  }

  scrapeComplete(count) {
    this.log('SCRAP', 'Complete. Retrieved ' + count + ' items.');
  }

  authState(saved, path) {
    this.log('AUTH', saved ? 'Auth state saved: ' + path : 'Auth state NOT saved');
  }

  export() {
    return this.logs.join('\n');
  }
}

export const logger = new Logger('debug.log');
export default Logger;
