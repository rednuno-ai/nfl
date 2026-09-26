import type { CareerState } from '@engine/career';
import { getCollege } from '@engine/colleges';

export function currentSchoolOrTeamLabel(state: CareerState): string {
  if (state.stage === 'high_school' || state.stage === 'recruiting') return state.highSchool.schoolName;
  if (state.stage === 'college' && state.college) return getCollege(state.college.collegeId)?.name ?? 'College';
  if (state.stage === 'draft') return 'NFL Draft Prospect';
  if (state.team) return `${state.team.city} ${state.team.name}`;
  return state.stage === 'free_agency' ? 'Free Agent' : 'Retired';
}
