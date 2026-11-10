import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DismissedMenuAction } from '../src/components/dismissed-menu-action.ts';

test('logout cannot clear the session while the native menu is still presented', () => {
  const menu=new DismissedMenuAction();let session='captain';
  assert.equal(menu.enqueue(()=>{session=null;}),true);
  assert.equal(session,'captain','closing visibility alone must not start logout');
  menu.dismissed();
  assert.equal(session,null);
});

test('rapid duplicate taps and repeated dismissal events do not start multiple actions',()=>{
  const menu=new DismissedMenuAction();let calls=0;
  assert.equal(menu.enqueue(()=>{calls++;}),true);
  assert.equal(menu.enqueue(()=>{calls+=10;}),false);
  menu.dismissed();menu.dismissed();assert.equal(calls,1);
  assert.equal(menu.enqueue(()=>{calls++;}),true);
  menu.dismissed();assert.equal(calls,2,'a failed action can be retried after reopening');
});

test('an unmounted menu cannot execute a pending action against a later account',()=>{
  const menu=new DismissedMenuAction();let navigated=false;
  menu.enqueue(()=>{navigated=true;});menu.dispose();menu.dismissed();
  assert.equal(navigated,false);assert.equal(menu.enqueue(()=>{navigated=true;}),false);
});
