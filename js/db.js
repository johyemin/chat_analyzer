window.ChatDB = (() => {

const DB_NAME = "chat_archive_db_story_v1"
const STORE_NAME = "messages"
const DB_META = "meta"

function open(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,1)

    req.onupgradeneeded = () => {
      const db = req.result

      if(!db.objectStoreNames.contains(STORE_NAME)){
        const store = db.createObjectStore(STORE_NAME,{keyPath:"id"})
        store.createIndex("ts","ts",{unique:false})
        store.createIndex("author","author",{unique:false})
        store.createIndex("conversationId","conversationId",{unique:false})
      }

      if(!db.objectStoreNames.contains(DB_META)){
        db.createObjectStore(DB_META,{keyPath:"key"})
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function putMany(db,rows){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([STORE_NAME],"readwrite")
    const store = tx.objectStore(STORE_NAME)
    for(const row of rows) store.put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function clearMessages(db){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([STORE_NAME],"readwrite")
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function clearAll(db){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([STORE_NAME,DB_META],"readwrite")
    tx.objectStore(STORE_NAME).clear()
    tx.objectStore(DB_META).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function count(db,storeName = STORE_NAME){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([storeName],"readonly")
    const req = tx.objectStore(storeName).count()
    req.onsuccess = () => resolve(req.result || 0)
    req.onerror = () => reject(req.error)
  })
}

function getAllMessages(db){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([STORE_NAME],"readonly")
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

function getMeta(db, key){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([DB_META],"readonly")
    const req = tx.objectStore(DB_META).get(key)
    req.onsuccess = () => resolve(req.result?.value)
    req.onerror = () => reject(req.error)
  })
}

function setMeta(db, key, value){
  return new Promise((resolve,reject)=>{
    const tx = db.transaction([DB_META],"readwrite")
    tx.objectStore(DB_META).put({key, value})
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

return {
  open,
  putMany,
  clearMessages,
  clearAll,
  count,
  getAllMessages,
  getMeta,
  setMeta,
  STORE_NAME,
  DB_META,
}

})()
