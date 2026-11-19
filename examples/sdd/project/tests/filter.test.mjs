import test from 'node:test';
import assert from 'node:assert/strict';
import {filterBenefits} from '../src/filter.mjs';
const input=()=>[{id:1,state:'active'},{id:2,state:'inactive'},{id:3,state:'active'}];
test('active preserves order and input',()=>{const data=input();assert.deepEqual(filterBenefits(data,'active').map(x=>x.id),[1,3]);assert.deepEqual(data,input());});
test('inactive',()=>assert.deepEqual(filterBenefits(input(),'inactive').map(x=>x.id),[2]));
test('all copies',()=>{const data=input();assert.deepEqual(filterBenefits(data),data);assert.notEqual(filterBenefits(data),data);});
test('unknown',()=>assert.throws(()=>filterBenefits(input(),'unknown'),RangeError));
