import { call, takeEvery, put, take } from 'redux-saga/effects'
import { push } from 'react-router-redux'

import locations from './locations'
import actions from './types'

function* allSagas() {
  yield takeEvery(actions.setAddress, handleAddressEntered)
  yield takeEvery(actions.setABI, handleABI)
  yield takeEvery(actions.setEvents, handleEvents)
}

function* handleABI(action) {
  yield put(push(locations.selectEvents))
}

function* handleEvents(action) {
  yield put(push(locations.howNotify))
}

function* handleSubmit(action) {
  yield put(push(locations.howNotify))
}

function* handleAddressEntered(action) {
  yield put(push(locations.lookingUp))
  const result = yield call(getABI, action.address)
  if (!result) {
    console.log('No abi', result)
    yield put(push(locations.insertABI))
  } else {
    console.log('have abi', result)
    yield put({
      type: actions.setABI,
      abi: result
    })
  }
}

async function getABI(address) {
  const url = `http://api.etherscan.io/api?module=contract&action=getabi&address=${address}&format=raw`
  return await fetch(url)
    .then(parseJson)
    .then(response => {
      if (response.message === "NOTOK") {
        return null
      }
      return response
    })
}

function parseJson(e) {
  return e.json()
}

export default allSagas
