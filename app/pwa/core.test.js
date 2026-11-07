'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('./core.js');
test('unknown routes safely fall back to home',()=>assert.equal(core.normalizeRoute('not-a-page'),'home'));
test('known routes remain available',()=>assert.equal(core.normalizeRoute('products'),'products'));
test('adding an item increments quantity without mutating input',()=>{const initial=[];const first=core.addItem(initial,{id:'a',name:'示範'});const second=core.addItem(first,{id:'a',name:'示範'});assert.equal(initial.length,0);assert.equal(second[0].quantity,2);});
test('cart count sums non-negative quantities',()=>assert.equal(core.countItems([{quantity:2},{quantity:1},{quantity:-5}]),3));
test('checkout stays disabled until real services are integrated',()=>assert.equal(core.canCheckout(),false));
