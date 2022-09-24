// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
// For side effects
import '/lib/model.js';
import { Messages, Puzzles } from '/lib/imports/collections.js';
import chai from 'chai';
import sinon from 'sinon';
import { resetDatabase } from 'meteor/xolvio:cleaner';
import delay from 'delay';
import { waitForDocument } from '/lib/imports/testutils.js';
import DriveChangeWatcher, {startPageTokens, driveFiles} from  './drive_change_polling.js';

const SPREADSHEET_TYPE = 'application/vnd.google-apps.spreadsheet';
const DOC_TYPE = 'application/vnd.google-apps.document';

describe('drive change polling', function() {
  this.timeout(10000);

  let clock = null;
  let api = null;
  let changes = null;
  let poller = null;
  let env = null;

  beforeEach(function() {
    resetDatabase();
    clock = sinon.useFakeTimers({
      now: 60007,
      toFake: ['Date']});

    env = {
      setTimeout: sinon.stub(),
      clearTimeout: sinon.stub()
    };
      
    api = {
      changes: {
        list() {},
        getStartPageToken() {}
      }
    };
    return changes = sinon.mock(api.changes);
  });

  afterEach(function() {
    poller?.stop();
    return clock.restore();
  });

  afterEach(() => sinon.verifyAndRestore());

  it('fetches page token when never polled', function() {
    changes.expects('getStartPageToken').once().resolves({data: {startPageToken: 'firstPage'}});
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    return chai.assert.include(startPageTokens.findOne(), {
      timestamp: 60007,
      token: 'firstPage'
    }
    );
  });

  it('polls immediately when poll is overdue', function() {
    startPageTokens.insert({
      timestamp: 7,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    return chai.assert.equal(env.setTimeout.firstCall.lastArg, 0);
  });

  it('waits to poll', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    return chai.assert.equal(env.setTimeout.firstCall.lastArg, 30000);
  });

  it('updates puzzle and does not announce when spreadsheet updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    const puzz = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      drive: 'foo_drive',
      doc: 'foo_doc',
      spreadsheet: 'foo_sheet'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_sheet',
        file: {
          name: 'Worksheet: Foo',
          mimeType: SPREADSHEET_TYPE,
          parents: ['foo_drive'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(Puzzles.findOne({canon: 'foo'}),
      {drive_touched: 31006});
    return chai.assert.isUndefined(Messages.findOne());
  });

  it('updates puzzle and does not announce when doc updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    const puzz = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      drive: 'foo_drive',
      doc: 'foo_doc',
      spreadsheet: 'foo_sheet'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_doc',
        file: {
          name: 'Notes: Foo',
          mimeType: DOC_TYPE,
          parents: ['foo_drive'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(Puzzles.findOne({canon: 'foo'}),
      {drive_touched: 31006});
    return chai.assert.isUndefined(Messages.findOne());
  });

  it('updates puzzle and announces when new file updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    const puzz = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      drive: 'foo_drive',
      doc: 'foo_doc',
      spreadsheet: 'foo_sheet'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['foo_drive'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(Puzzles.findOne({canon: 'foo'}),
      {drive_touched: 31006});
    chai.assert.include(driveFiles.findOne('foo_other'),
      {announced: 60007});
    return chai.assert.deepInclude(Messages.findOne(), {
      room_name: `puzzles/${puzz}`,
      system: true,
      file_upload: {
        mimeType: 'image/svg+xml',
        webViewLink: 'https://blahblahblah.com',
        name: 'Drawing about Foo',
        fileId: 'foo_other'
      }
    }
    );
  });

  it('updates puzzle announces and sets doc when new doc updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    const puzz = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      drive: 'foo_drive',
      spreadsheet: 'foo_sheet'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_doc',
        file: {
          name: 'Notes: Foo',
          mimeType: DOC_TYPE,
          parents: ['foo_drive'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(Puzzles.findOne({canon: 'foo'}), {
      drive_touched: 31006,
      doc: 'foo_doc'
    }
    );
    chai.assert.include(driveFiles.findOne('foo_doc'),
      {announced: 60007});
    return chai.assert.deepInclude(Messages.findOne(), {
      room_name: `puzzles/${puzz}`,
      system: true,
      file_upload: {
        mimeType: DOC_TYPE,
        webViewLink: 'https://blahblahblah.com',
        name: 'Notes: Foo',
        fileId: 'foo_doc'
      }
    }
    );
  });

  it('updates puzzle and does not announce when announced file updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    driveFiles.insert({
      _id: 'foo_other',
      announced: 5
    });
    const puzz = Puzzles.insert({
      name: 'Foo',
      canon: 'foo',
      drive: 'foo_drive',
      doc: 'foo_doc',
      spreadsheet: 'foo_sheet'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['foo_drive'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(Puzzles.findOne({canon: 'foo'}),
      {drive_touched: 31006});
    return chai.assert.isUndefined(Messages.findOne());
  });

  it('announces in general chat when new file updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['root_folder'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.include(driveFiles.findOne('foo_other'),
      {announced: 60007});
    return chai.assert.deepInclude(Messages.findOne(), {
      room_name: 'general/0',
      system: true,
      file_upload: {
        mimeType: 'image/svg+xml',
        webViewLink: 'https://blahblahblah.com',
        name: 'Drawing about Foo',
        fileId: 'foo_other'
      }
    }
    );
  });

  it('does not announce in general chat when announced file updated', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    driveFiles.insert({
      _id: 'foo_other',
      announced: 5
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['root_folder'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    return chai.assert.isUndefined(Messages.findOne());
  });

  it('does not announce when new file updated in unknown folder', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    changes.expects('list').once().withArgs(sinon.match({pageToken: 'firstPage'})).resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['somewhere_else'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    return chai.assert.isUndefined(Messages.findOne());
  });

// Test when initial poll fails, polls are rescheduled

  it('calls again with next page token', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    const list = changes.expects('list').twice().onFirstCall().resolves({data: {
      nextPageToken: 'continue',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['root_folder'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }
    }).onSecondCall().resolves({data: {
      newStartPageToken: 'secondPage',
      changes: [{
        changeType: 'file',
        fileId: 'unknown_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['somewhere_else'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }});
    poller.poll();
    chai.assert.deepInclude(Messages.findOne(), {
      room_name: 'general/0',
      system: true,
      file_upload: {
        mimeType: 'image/svg+xml',
        webViewLink: 'https://blahblahblah.com',
        name: 'Drawing about Foo',
        fileId: 'foo_other'
      }
    }
    );
    chai.assert.include(list.getCall(0).args[0],
      {pageToken: 'firstPage'});
    chai.assert.include(list.getCall(1).args[0],
      {pageToken: 'continue'});
    return chai.assert.include(startPageTokens.findOne(), {
      timestamp: 60007,
      token: 'secondPage'
    }
    );
  });

  return it('does not announce when failure on next page token', function() {
    startPageTokens.insert({
      timestamp: 30007,
      token: 'firstPage'
    });
    poller = new DriveChangeWatcher(api, 'root_folder', env);
    const list = changes.expects('list').twice().onFirstCall().resolves({data: {
      nextPageToken: 'continue',
      changes: [{
        changeType: 'file',
        fileId: 'foo_other',
        file: {
          name: 'Drawing about Foo',
          mimeType: 'image/svg+xml',
          parents: ['root_folder'],
          createdTime: '1970-01-01T00:00:31.006Z',
          modifiedTime: '1970-01-01T00:00:31.006Z',
          webViewLink: 'https://blahblahblah.com'
        }
      }
      ]
    }
    }).onSecondCall().rejects('error');
    poller.poll();
    chai.assert.isUndefined(Messages.findOne());
    chai.assert.include(list.getCall(0).args[0],
      {pageToken: 'firstPage'});
    chai.assert.include(list.getCall(1).args[0],
      {pageToken: 'continue'});
    return chai.assert.include(startPageTokens.findOne(), {
      timestamp: 30007,
      token: 'firstPage'
    }
    );
  });
});
