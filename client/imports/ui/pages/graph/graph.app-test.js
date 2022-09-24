// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
import {waitForSubscriptions, afterFlushPromise, promiseCall, login, logout} from '/client/imports/app_test_helpers.js';
import Router from '/client/imports/router.js';
import chai from 'chai';
import denodeify from 'denodeify';

const awaitRender = () => new Promise(resolve => $('body').one('bb-graph-render', resolve));

describe('graph', function() {
  this.timeout(20000);

  after(() => logout());

  return it('renders', async function() {
    let p = awaitRender();
    Router.GraphPage();
    await login('testy', 'Teresa Tybalt', '', 'failphrase');
    await afterFlushPromise();
    await waitForSubscriptions();
    await afterFlushPromise();
    await p;
    chai.assert.isAtLeast($('.bb-status-graph canvas').length, 1);
    p = awaitRender();
    const round = await promiseCall('newRound', {name: 'Graph Test Round'});
    await afterFlushPromise();
    await p;
    p = awaitRender();
    const meta = await promiseCall('newPuzzle', {
      name: 'Graph Test Meta',
      round: round._id
    }
    );
    await afterFlushPromise();
    await p;
    p = awaitRender();
    const leaf = await promiseCall('newPuzzle', {
      name: 'Graph Test Leaf',
      round: round._id,
      feedsInto: [meta._id]
    });
    await afterFlushPromise();
    await p;
    await promiseCall('renameRound', {
      id: round._id,
      name: 'Round of Graph Testing'
    }
    );
    await afterFlushPromise();
    await promiseCall('renamePuzzle', {
      id: leaf._id,
      name: 'Leaf of Graph Testing'
    }
    );
    await afterFlushPromise();
    p = awaitRender();
    await promiseCall('unfeedMeta', leaf._id, meta._id);
    await afterFlushPromise();
    await p;
    p = awaitRender();
    await promiseCall('deletePuzzle', leaf._id);
    await afterFlushPromise();
    await p;
    p = awaitRender();
    await promiseCall('deletePuzzle', meta._id);
    await afterFlushPromise();
    await p;
    p = awaitRender();
    await promiseCall('deleteRound', round._id);
    await afterFlushPromise();
    return await p;
  });
});
