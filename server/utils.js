const { getUser, checkUserName } = require('./database/queries')
const { pool } = require('./database/init')
const { getMessagesQuery, insertMessageQuery } = require('./database/queries')

function validatePassword (body) {
  if (body.password.length < 8) return 'invalid' // semantic meaning not the job
  return 'valid'
}

async function validateUserName (user_name) {
  const response = await pool.query(checkUserName, [user_name])
  return response.rows.length ? false : true
}
async function loginCreds (body) {
  const response = await pool.query(getUser, [body.userName])
  const creds = response.rows // send cookies rather than creds to front end
  console.log(creds[0])
  return creds[0] // unique constraint on user name
}

async function getMessagesFn () {
  const messages = (await pool.query(getMessagesQuery)).rows // db model
  return messages
}

async function insertMessageFn (msg) {
  await pool.query(insertMessageQuery, [msg.message, msg.timeStamp, msg.userName])
}
module.exports = { validatePassword, loginCreds, getMessagesFn, insertMessageFn, validateUserName }