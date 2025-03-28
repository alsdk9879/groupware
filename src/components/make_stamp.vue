<template lang="pug">
.input-wrap.canvas-wrap
    p.label.essential(v-if="!onlySign" style="margin-bottom: 8px;") 서명란
    canvas#stampCanvas(ref="canvas")

.input-wrap(v-if="!onlySign")
    p.label 도장명
    input(v-model="stampName" type="text" name="fileName" placeholder="도장명을 입력해주세요. 예) 회사직인, 개인직인 등" @click.stop="savedState.value && restoreCanvasState(savedState.value)")

.button-wrap
    button.btn.bg-gray(v-if="!onlySign" @click="closeDialog") 취소
    button.btn.outline(@click="reset") 초기화
    button.btn(@click="sendStampBlob") {{ onlySign ? '완료' : '등록' }}
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { openStampModal, uploadingStamp, handleStampBlob, stampName, onlyStamp } from '@/components/make_stamp';

const emit = defineEmits(['close', 'save', 'upload']);
const props = defineProps({
    onlySign: Boolean,
});

let step = ref('options');

let canvas = ref(null);
let ctx = null;
let painting = false;

// 캔버스 상태 저장
function saveCanvasState() {
    if (!canvas.value) return null;
    return canvas.value.toDataURL();
}

// 캔버스 상태 복구
function restoreCanvasState(dataUrl) {
    if (!dataUrl) return;

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
        if (ctx && canvas.value) {
            ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
            ctx.drawImage(img, 0, 0);
        }
    };
}

// input 클릭 시 상태 저장 및 복구
const savedState = ref(null);

// 마우스 좌표를 캔버스에 맞게 조정
function getMousePos(canvas, event) {
    let rect = canvas.getBoundingClientRect();

    return {
        x: ((event.clientX - rect.left) / (rect.right - rect.left)) * canvas.width,
        y: ((event.clientY - rect.top) / (rect.bottom - rect.top)) * canvas.height
    };
}
// function getMousePos(canvas, event) {
//     let rect = canvas.getBoundingClientRect();

//     return {
//         x: event.clientX - rect.left,
//         y: event.clientY - rect.top
//     };
// }

// 캔버스 크기 설정
const resizeCanvas = () => {
    if (!canvas.value) return;

    // 현재 상태 저장
    const savedStateData = saveCanvasState();

    // 캔버스의 CSS 크기와 실제 픽셀 크기를 일치시킵니다.
    const width = canvas.value.offsetWidth;
    const height = canvas.value.offsetHeight;

    canvas.value.width = width;
    canvas.value.height = height;

    // 상태 복구
    restoreCanvasState(savedStateData);
};
// const resizeCanvas = () => {
// 	// 현재 상태 저장
//     savedState.value = saveCanvasState();

//     // 상태 복구
//     restoreCanvasState(savedState.value);
//     // const width = canvas.value.offsetWidth;
//     // const height = canvas.value.offsetHeight;
    
//     // canvas.value.width = width;
//     // canvas.value.height = height;

//     // // 기존 서명 복원 (리사이즈 시 데이터 손실 방지)
//     // if (ctx) ctx.clearRect(0, 0, width, height);
// };

// 서명 시작
function startPosition(e) {
    painting = true;
    draw(e);
}

// 서명 끝
function endPosition() {
    painting = false;
	savedState.value = saveCanvasState(); // 상태 저장
    ctx.beginPath(); // 새로운 경로 시작
}

// 서명 그리기
function draw(e) {
    if (!painting) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';

    let pos = getMousePos(canvas.value, e);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

let reset = () => {
    stampName.value = '';

    if (ctx && canvas.value) {
        ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);
    }
}

let upload = () => {
    reset();
    emit('upload');
    // openStampModal.value = false;
}

let closeDialog = () => {
	document.querySelector('body').style.overflow = 'auto';
    reset();        // stamp maker 초기화
    emit('close');  // 부모 컴포넌트에 닫기 이벤트 전달
};

let sendStampBlob = () => {
    // 서명 이미지 바로 저장할때 사용
    // let dataURL = canvas.value.toDataURL('image/png');
    // let link = document.createElement('a');

    // link.href = dataURL;
    // link.download = 'signature.png';
    // link.click();
    if (!canvas.value) return;

    let fileName = document.querySelector('input[name="fileName"]');
    let imageData = ctx.getImageData(0, 0, canvas.value.width, canvas.value.height, { willReadFrequently: true });
    let isCanvasEmpty = !imageData.data.some((pixelValue) => pixelValue !== 0);

    if (isCanvasEmpty) {
        alert('서명란에 서명을 입력해주세요.');
        return;
    }
    // if (!fileName.value) {
    //     alert('도장명을 입력해주세요.');
    //     fileName.focus();
    //     return;
    // }

    canvas.value.toBlob((blob) => {
        if (blob) {
            const imageUrl = URL.createObjectURL(blob);
            emit("upload", imageUrl); // Blob 전달
            // handleStampBlob(imageUrl);
        }
    }, "image/png");
}

onMounted(() =>{
    if (!canvas.value) return;
    if (props.onlySign) {
        onlyStamp.value = true;
    }

    document.querySelector('body').style.overflow = 'hidden';

    resizeCanvas();

    ctx = canvas.value.getContext("2d");

    reset();

	// 초기 상태 저장
	savedState.value = saveCanvasState();
    
    // Pointer 이벤트로 마우스/터치 통합 처리
    canvas.value.addEventListener("pointerdown", startPosition);
    canvas.value.addEventListener("pointermove", draw);
    canvas.value.addEventListener("pointerup", endPosition);

    // 윈도우 리사이즈 시 캔버스 크기 재조정
    window.addEventListener("resize", resizeCanvas);
})

onUnmounted(() => {
	window.document.querySelector('body').style.overflow = 'auto';
    if (!canvas.value) return;

    // Pointer 이벤트로 마우스/터치 통합 처리
    canvas.value.removeEventListener("pointerdown", startPosition);
    canvas.value.removeEventListener("pointermove", draw);
    canvas.value.removeEventListener("pointerup", endPosition);

    window.removeEventListener("resize", resizeCanvas);
})
</script>

<style scoped lang="less">
#stamp-img {
    width: 100px;
    height: 100px;
    border-radius: 30%;
    display: block;
    margin: 0 auto;
    object-fit: contain;
    position: relative;
    background-color: #fff;
    border: 2px dashed var(--gray-color-100);

    &::before {
        content: "미리보기";
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        color: #888;
        background-color: #fff;
        font-size: 14px;
        text-align: center;
        position: absolute;
        top: 0;
        left: 0;
    }
}

.modal-cont {
    margin: auto;
}

.option-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;

    button {
        min-width: 150px;
        flex-grow: 1;
    }
}

.preview-wrap {
    text-align: center;
}

.canvas-wrap {
    margin: 0;
    touch-action: none;
}

canvas {
    width: 100%;
    height: 100%;
    border: 1px solid var(--gray-color-200);
    border-radius: 0.5rem;
}

.button-wrap {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 20px;
}

@media (max-width: 576px) {
    .modal-cont {
        width: 100%;
        height: 100%;
        min-width: 100%;
        border-radius: 0;
        padding-top: 3rem;
        // display: flex;
        // flex-wrap: nowrap;
        // align-items: center;
        // justify-content: center;
        // flex-direction: column;

        .canvas-wrap {
            width: 100%;
        }
    }
}
</style>