'use strict';const test=require('node:test');const assert=require('node:assert/strict');const core=require('./core.js');
test('unknown routes safely fall back to home',()=>assert.equal(core.normalizeRoute('not-a-page'),'home'));
test('known routes remain available',()=>assert.equal(core.normalizeRoute('products'),'products'));
test('adding an item increments quantity without mutating input',()=>{const initial=[];const first=core.addItem(initial,{id:'a',name:'示範'});const second=core.addItem(first,{id:'a',name:'示範'});assert.equal(initial.length,0);assert.equal(second[0].quantity,2);});
test('cart count sums non-negative quantities',()=>assert.equal(core.countItems([{quantity:2},{quantity:1},{quantity:-5}]),3));
test('checkout stays disabled until real services are integrated',()=>assert.equal(core.canCheckout(),false));
test('cart quantity can increase and decrease but never fall below one',()=>{const cart=[{id:'x',name:'X',quantity:1}];assert.equal(core.updateItem(cart,'x','plus')[0].quantity,2);assert.equal(core.updateItem(cart,'x','minus')[0].quantity,1);});
test('cart item can be removed without mutating source',()=>{const cart=[{id:'x',name:'X',quantity:1}];assert.deepEqual(core.updateItem(cart,'x','remove'),[]);assert.equal(cart.length,1);});
test('unknown cart item action leaves cart unchanged',()=>assert.equal(core.updateItem([{id:'x',quantity:1}],'x','noop')[0].quantity,1));