export interface SimulationEvent {
  type:
    | 'bead_completed'
    | 'bead_created'
    | 'bead_started'
    | 'branch_updated'
    | 'chat_message'
    | 'conflict'
    | 'sprint_boundary';
  persona?: string;
  bead_id?: string;
  description: string;
  sim_time: { day: number; hour: number };
}
