<template lang="pug">
.organigram-wrap
	template(v-if="loading")
		Loading
	template(v-else)
		Department(v-for="(department, index) in organigram" :key="index" :useCheckbox="useCheckbox" :department="department" :selectedAuditors="selectedAuditors" :modalType="modalType" @update-check="onDepartmentCheck")
</template>

<script lang="ts" setup>
import { type Ref, ref, watch, nextTick } from 'vue'
import { skapi } from '@/main'
import { user, makeSafe } from '@/user'
import {
	loading,
	divisions,
	divisionNameList,
	getDivisionData,
	getDivisionDataRunning,
	getDivisionNamesRunning,
} from "@/division";

import Loading from '@/components/loading.vue'
import Department from '@/components/department.vue'

const emit = defineEmits(['selection-change']);
// const selectedEmployees = ref([]);
const tableUsers = ref([]);

const props = defineProps({
	selectedEmployees: {
		type: Array,
		default: () => [],
	},
	excludeCurrentUser: { // 결재요청시 본인 제외
		type: Boolean,
		default: false
	},
	modalType: {  // modalType prop 추가
		type: String,
		required: false
	},
	selectedAuditors: {  // selectedAuditors prop 추가
		type: Object,
		required: false
	},
	useCheckbox: {
		type: Boolean,
		default: false
	}
});

const organigramProps = {
	selectedEmployees: tableUsers // 새로운 prop 추가
};

type Organigram = {
	division: string | null;
	name: string;
	members: any[];
	subDepartments: Organigram[];
	total: number;
	isChecked: boolean;
};

let currentEmpData = ref([]);
let getEmpPositionCurrentRunning: Promise<any> | null = null;
let organigram: Ref<Organigram[]> = ref([]);
let checkedUsers = ref<{}>([]);
let loading = ref(false);

async function getEmpPositionCurrent() {
	if(getEmpPositionCurrentRunning instanceof Promise) { // 이미 실행중인 경우
		console.log('!!!!!실행중 getEmpPositionCurrentRunning')
		await getEmpPositionCurrentRunning;
		return currentEmpData.value;
	}

	getEmpPositionCurrentRunning = skapi.getRecords({
		table: {
			name: 'emp_position_current',
			access_group: 1,
		},
	}).finally(() => {
		getEmpPositionCurrentRunning = null;

		if (getDivisionDataRunning instanceof Promise) {
			getDivisionDataRunning.finally(() => {
				loading.value = false;
			});
		} else {
			loading.value = false;
		}
	});

	let res = await getEmpPositionCurrentRunning;

	if (res.list.length) {
		currentEmpData.value = res.list;
	}

	// 예전에 지운 유저인데 남아있는 데이터 삭제
	// for(let data of currentEmpData.value) {
	// 	skapi.getUsers({
	// 		searchFor: 'user_id',
	// 		value: data.data.user_id,
	// 	}).then((res) => {
	// 		console.log(res)
	// 		if(!res.list.length) {
	// 			skapi.deleteRecords({
	// 				unique_id: "[emp_position_current]" + makeSafe(data.data.user_id)
	// 			}).catch(err=>{
	// 				console.log(err);
	// 			});
	// 		}
	// 	});
	// }

	return currentEmpData.value;
}
getEmpPositionCurrent();

async function addDepartment(path: string[], division: string | null, currentLevel: Organigram[]) {
	if (getEmpPositionCurrentRunning instanceof Promise) {
		await getEmpPositionCurrentRunning;
	}

	if (getDivisionNamesRunning instanceof Promise) {
		await getDivisionNamesRunning;
	}

	const name = path[0]; // 현재 부서 이름
	const restPath = path.slice(1); // 나머지 경로

	// 현재 레벨에서 해당 이름을 가진 부서 찾기
	let department = currentLevel.find((dept) => dept.name === name);

	if (!department) {
		// 부서가 없으면 새로 추가
		department = {
			division: restPath.length === 0 ? division : null, // 마지막 레벨만 division 할당
			name,
			members: [],
			subDepartments: [],
			total: 0,
			isChecked: false
		};

		currentLevel.push(department);
	}

	// 하위 경로가 있으면 재귀적으로 처리
	if (restPath.length > 0) {
		// addDepartment(restPath, division, department.subDepartments);
		await addDepartment(restPath, division, department.subDepartments);
	}

	// 하위 부서의 데이터를 상위 부서로 합산
	department.total = department.members.length + department.subDepartments.reduce((sum, subDept) => sum + subDept.total, 0);

	// 마지막 레벨이면 멤버 추가
	if (restPath.length === 0) {
		// for (let data of currentEmpData.value) {
		// 	if (data.index.name.includes(division)) {
		// 		department.members.push(data);
		// 	}
		// }

	// 현재 부서의 모든 직원 데이터를 가져옴
	const departmentMembers = currentEmpData.value.filter(data => 
		data.index.name.includes(division)
	);

	// excludeCurrentUser가 true일 때만 현재 사용자 제외
	department.members = props.excludeCurrentUser 
		? departmentMembers.filter(data => data.data.user_id !== user.user_id)
		: departmentMembers;

		// 멤버 수 업데이트
		department.total = department.members.length + department.subDepartments.reduce((sum, subDept) => sum + subDept.total, 0);

	return department;
	}
}

async function getOrganigram() {
	loading.value = true;
	organigram.value = []; // 초기화

	try {
		if (getDivisionNamesRunning instanceof Promise) {
			await getDivisionNamesRunning;
		}

		if (getEmpPositionCurrentRunning instanceof Promise) {
			  await getEmpPositionCurrentRunning;
		}

		for (const division in divisionNameList.value) {
			const fullName = divisionNameList.value[division];
			if (typeof fullName !== 'string') continue;

			const path = fullName.split('/');
			await addDepartment(path, division, organigram.value);
		}

		// 빈 부서 제거 (멤버가 0명이고 하위 부서도 없는 경우)
		const filterEmptyDepartments = (departments: Organigram[]) => {
			return departments.filter(dept => {
				// 하위 부서가 있으면 재귀적으로 필터링
				if (dept.subDepartments.length > 0) {
				  dept.subDepartments = filterEmptyDepartments(dept.subDepartments);
				}
				
				// 멤버가 있거나 하위 부서가 있는 경우만 유지
				return dept.members.length > 0 || dept.subDepartments.length > 0;
			});
		};

		organigram.value = filterEmptyDepartments(organigram.value);
		console.log('=== getOrganigram === organigram : ', organigram.value);
	} catch (error) {
		console.error('=== getOrganigram === error : ', error);
	} finally {
		loading.value = false;
	}
}

// Watch props.excludeCurrentUser 변경을 감지하여 조직도 다시 로드
watch(() => props.excludeCurrentUser, () => {
	getOrganigram();
});

getOrganigram();

function onDepartmentCheck(obj: { type: string; target: any; isChecked: boolean }) {
	const { type, target, isChecked } = obj;

	console.log(obj)

	if (type === 'department') {
		// 현재 부서 및 모든 하위 부서와 멤버 상태를 동기화
		updateChildrenCheckStatus(target, isChecked);

		// 부모 부서의 체크 상태도 업데이트
		updateParentCheckStatus(target);
	} else if (type === 'member') {
		// 멤버의 상태를 업데이트
		target.isChecked = isChecked;

		// 부모 부서의 체크 상태 업데이트
		updateParentCheckStatus(target);
	}

	// 체크된 사용자 ID 업데이트
	// checkedUserIds.value = currentEmpData.value.filter((data) => data.isChecked).map((data) => data.data.user_id);
	checkedUsers.value = currentEmpData.value.filter((data) => data.isChecked);

	console.log(checkedUsers.value);
	emit('selection-change', checkedUsers.value);
}

// function onDepartmentCheck(obj: { type: string; target: any; isChecked: boolean }) {
//   const { type, target, isChecked } = obj;

//   console.log('=== onDsdfdsfsdfsepartmentCheck ===', type, target, isChecked);

//   if (type === 'department') {
//     updateChildrenCheckStatus(target, isChecked);
//     updateParentCheckStatus(target);

//     // 팀 체크박스 선택 시 해당 팀의 모든 직원 추가
//     if (target.members?.length > 0) {
//       target.members.forEach((member: any) => {
//         const index = props.selectedEmployees.findIndex(e => e.userId === member.data.user_id);
//         if (isChecked && index === -1) {
//           props.selectedEmployees.push({
//             userId: member.data.user_id,
//             name: member.index.value,
//             position: member.index.name.split('.')[1],
//             division: divisionNameList.value[member.index.name.split('.')[0]]
//           });
//         } else if (!isChecked && index !== -1) {
//           props.selectedEmployees.splice(index, 1);
//         }
//       });
//     }

//     // 하위 부서의 직원들도 추가
//     if (target.subDepartments?.length > 0) {
//       target.subDepartments.forEach((subDept: any) => {
//         addDepartmentEmployees(subDept, isChecked);
//       });
//     }

//     emit('selection-change', props.selectedEmployees);
//   } else if (type === 'member') {
//     // 기존 member 체크박스 로직 유지
//     target.isChecked = isChecked;
//     updateParentCheckStatus(target);

//     const index = props.selectedEmployees.findIndex(e => e.userId === target.data.user_id);
//     if (isChecked && index === -1) {
//       props.selectedEmployees.push({
//         userId: target.data.user_id,
//         name: target.index.value,
//         position: target.index.name.split('.')[1],
//         division: divisionNameList.value[target.index.name.split('.')[0]]
//       });
//     } else if (!isChecked && index !== -1) {
//       props.selectedEmployees.splice(index, 1);
//     }
	
//     emit('selection-change', props.selectedEmployees);
//   }

//   checkedUserIds.value = currentEmpData.value
//     .filter((data) => data.isChecked)
//     .map((data) => data.data.user_id);
// }

// 부서의 모든 직원을 재귀적으로 추가/제거하는 헬퍼 함수
function addDepartmentEmployees(department: any, isChecked: boolean) {
  if (department.members?.length > 0) {
	department.members.forEach((member: any) => {
	  const index = props.selectedEmployees.findIndex(e => e.userId === member.data.user_id);
	  if (isChecked && index === -1) {
		props.selectedEmployees.push({
		  userId: member.data.user_id,
		  name: member.index.value,
		  position: member.index.name.split('.')[1],
		  division: divisionNameList.value[member.index.name.split('.')[0]]
		});
	  } else if (!isChecked && index !== -1) {
		props.selectedEmployees.splice(index, 1);
	  }
	});
  }

  if (department.subDepartments?.length > 0) {
	department.subDepartments.forEach((subDept: any) => {
	  addDepartmentEmployees(subDept, isChecked);
	});
  }
}

// 자식(하위 부서 및 멤버) 상태를 업데이트하는 함수
function updateChildrenCheckStatus(department: any, isChecked: boolean) {
	department.isChecked = isChecked;

	// 멤버 상태 동기화
	if (department.members && department.members.length > 0) {
		department.members.forEach((member: any) => {
			member.isChecked = isChecked;
		});
	}

	// 하위 부서 상태 동기화
	if (department.subDepartments && department.subDepartments.length > 0) {
		department.subDepartments.forEach((sub: any) => {
			updateChildrenCheckStatus(sub, isChecked);
		});
	}	
}

// 부모 부서 상태를 업데이트하는 함수
function updateParentCheckStatus(item: any) {
	const parentDepartment = findParentDepartment(item); // 부모 부서를 찾는 함수
	if (!parentDepartment) return;

	// 모든 멤버가 체크되었는지 확인
	const allMembersChecked =
		parentDepartment.members.length === 0 ||
		parentDepartment.members.every((member: any) => member.isChecked);

	// 모든 하위 부서가 체크되었는지 확인
	const allSubDepartmentsChecked =
		parentDepartment.subDepartments.length === 0 ||
		parentDepartment.subDepartments.every((sub: any) => sub.isChecked);

	// 부모 부서의 체크 상태 업데이트
	parentDepartment.isChecked = allMembersChecked && allSubDepartmentsChecked;

	// 부모 부서의 부모 상태도 동기화
	updateParentCheckStatus(parentDepartment);
}

// 부모 부서를 찾는 함수
function findParentDepartment(item: any): any {
	for (const department of organigram.value) {
		if (department.members.includes(item) || department.subDepartments.includes(item)) {
			return department;
		}

		for (const sub of department.subDepartments) {
			const parent = findParentDepartmentRecursive(sub, item);
			if (parent) return parent;
		}
	}
	return null;
}

function findParentDepartmentRecursive(department: any, item: any): any {
	if (department.members.includes(item) || department.subDepartments.includes(item)) {
		return department;
	}

	for (const sub of department.subDepartments) {
		const parent = findParentDepartmentRecursive(sub, item);
		if (parent) return parent;
	}

	return null;
}

// watch로 selectedEmployees 변경 감지하여 체크박스 상태 업데이트
// watch(() => props.selectedEmployees, (newVal) => {
//     console.log('=== watch newVal ===', newVal);
// 	console.log(props.selectedAuditors);

//     if (newVal) {
// 		onDepartmentCheck({type: 'member', target: newVal, isChecked: false});
//     //   // 체크박스 상태 초기화
//     //     currentEmpData.value.forEach(emp => {
//     //       emp.isChecked = newVal.some(selected => selected.userId === emp.data.user_id);
//     //     });
//     //     console.log('=== watch currentEmpData ===', currentEmpData.value);
//     }
//     // console.log('=== watch selectedEmployees ===', props.selectedEmployees);
// }, { deep: true, immediate: true });
watch(() => props.selectedEmployees, async(nv, ov) => {
	if (!ov) {
		console.log(nv)
		// 모달 열었을때 체크된 사용자가 여러명 있을 경우
		// if (nv && nv.length > 0) {
		// 	await nextTick();

		// 	nv.forEach((user: any) => {
		// 		onDepartmentCheck({type: 'member', target: user, isChecked: true});
		// 	});
		// }
	} else {
		console.log(nv, ov);
	
		// 삭제된 유저 찾기 (oldValue에는 있지만 newValue에는 없는 항목)
		const removedUsers = ov.filter(
			oldUser => !nv.some(newUser => newUser.data.user_id === oldUser.data.user_id)
		);
	
		if (removedUsers.length > 0) {
			await nextTick();
			onDepartmentCheck({type: 'member', target: removedUsers[0], isChecked: false});
		}
	}
}, { immediate: true, deep: true });
</script>

<style lang="less" scoped>

</style>