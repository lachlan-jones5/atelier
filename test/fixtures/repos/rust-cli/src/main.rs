use clap::{Parser, Subcommand};

mod commands;

#[derive(Parser)]
#[command(name = "rcli", about = "A sample CLI tool")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize a new project
    Init {
        #[arg(short, long)]
        name: String,
    },
    /// Run the main process
    Run {
        #[arg(short, long, default_value = "default")]
        profile: String,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init { name } => commands::init(&name),
        Commands::Run { profile } => commands::run(&profile),
    }
}
