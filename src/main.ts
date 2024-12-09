import './assets/less/main.less';

import { createApp, ref } from 'vue';
import { Skapi } from 'skapi-js';
import { user, profileImage} from './user';
import App from './App.vue';
import router from './router';

const app = createApp(App);

export let iwaslogged = ref(false);
export let loaded = ref(false);

function getChanges(before, after) {
  const beforeKeys = new Set(Object.keys(before));
  const afterKeys = new Set(Object.keys(after));

  const addedKeys = [...afterKeys].filter(key => !beforeKeys.has(key));
  const removedKeys = [...beforeKeys].filter(key => !afterKeys.has(key));
  const modifiedKeys = [...afterKeys].filter(key => beforeKeys.has(key) && before[key] !== after[key]);

  return { added: addedKeys, removed: removedKeys, modified: modifiedKeys };
}

export let loginCheck = async(profile: object | null) => {
  if (profile) {
    console.log(profile)
    let originalUser = { ...user }

    Object.assign(user, profile);

    for (const key in originalUser) {
      if (!profile.hasOwnProperty(key)) {
        delete user[key];
      }
    }
    
    if (user.picture) {
      skapi.getFile(user.picture, {
        dataType: 'endpoint',
      })
      .then((res) => {  
        profileImage.value = res;
      })
      .catch((err) => {
        window.alert('프로필 사진을 불러오는데 실패했습니다.');
        throw err; // 의도적으로 에러 전달
      });
    } else {
      profileImage.value = null;
    }
    
    iwaslogged.value = true;
  } else {   
    if(iwaslogged.value) {
      Object.assign(user, {});
      iwaslogged.value = false;
    }
  }
  // console.log('profile', profile)
  // console.log('iwaslogged', iwaslogged.value)
  loaded.value = true;
};

const skapi = new Skapi(
  'ap21WQQ42ZUVa3GYCmGr',
  '5750ee2c-f7f7-43ff-b6a5-cce599d30101',
  { autoLogin: window.localStorage.getItem('remember') === 'true', eventListener: {onLogin: loginCheck} },
  { hostDomain: 'skapi.app', target_cdn: 'd1wrj5ymxrt2ir' }
); // pb

// const skapi = new Skapi(
//   'ap21T837jUF8IFyfR98Z',
//   'f498d188-1fa5-43e5-a32d-904d3e125983',
//   { autoLogin: false },
//   { hostDomain: 'skapi.app', target_cdn: 'd1wrj5ymxrt2ir' }
// );

app.use(router);

app.mount('#app');

export { skapi };
