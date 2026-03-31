import simpleGit from 'simple-git';

export interface DiffContext {
  branch: string;
  baseBranch: string;
  files: DiffFile[];
  summary: string;         // Human-readable summary
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
}

/**
 * Extract structured diff context between a branch and its base.
 * Uses simple-git to get the diff summary and parses it into DiffFile objects.
 */
export async function extractDiffContext(
  projectRoot: string,
  branch: string,
  baseBranch?: string,
): Promise<DiffContext> {
  const git = simpleGit(projectRoot);

  // Determine base branch: use provided value, or detect main/master.
  let base = baseBranch;
  if (!base) {
    const branches = await git.branchLocal();
    if (branches.all.includes('main')) {
      base = 'main';
    } else if (branches.all.includes('master')) {
      base = 'master';
    } else {
      base = branches.all[0] ?? 'main';
    }
  }

  // Get diff summary between base and branch.
  const diffSummary = await git.diffSummary([`${base}...${branch}`]);

  const files: DiffFile[] = diffSummary.files.map((f) => {
    let status: DiffFile['status'];
    // simple-git DiffResultTextFile has `file`, `changes`, `insertions`, `deletions`
    // Binary files have a different shape but we handle them as modified.
    const textFile = f as {
      file: string;
      insertions: number;
      deletions: number;
      changes: number;
    };

    if (textFile.insertions > 0 && textFile.deletions === 0 && textFile.changes === textFile.insertions) {
      status = 'added';
    } else if (textFile.deletions > 0 && textFile.insertions === 0) {
      status = 'deleted';
    } else {
      status = 'modified';
    }

    return {
      path: textFile.file,
      status,
      additions: textFile.insertions,
      deletions: textFile.deletions,
    };
  });

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const summary = `${files.length} file(s) changed: +${totalAdditions} -${totalDeletions} (${base}...${branch})`;

  return { branch, baseBranch: base, files, summary };
}
