use anyhow::Result;

pub fn init(name: &str) -> Result<()> {
    println!("Initializing project: {name}");
    // TODO: create project directory structure
    Ok(())
}

pub fn run(profile: &str) -> Result<()> {
    println!("Running with profile: {profile}");
    // TODO: load config and execute
    Ok(())
}
