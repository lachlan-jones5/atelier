import { ReviewStatus, ReviewVerdict, CommentSeverity } from '../util/types.js';

export interface ReviewRequest {
  id: string;
  bead_id: string;
  submitted_by: string;     // "user" or persona slug
  branch: string;
  team: string;             // team slug
  reviewers: string[];      // persona slugs
  status: ReviewStatus;
  rounds: ReviewRound[];
  created_at: string;
  updated_at: string;
}

export interface ReviewRound {
  round_number: number;
  feedback: ReviewerFeedback[];
  submitted_at: string;
  resolved_at?: string;
}

export interface ReviewerFeedback {
  reviewer: string;         // persona slug
  comments: ReviewComment[];
  verdict: ReviewVerdict;
}

export interface ReviewComment {
  file: string;
  line?: number;
  body: string;
  severity: CommentSeverity;
}
