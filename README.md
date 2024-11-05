# Obsidian Random Tagged Note Plugin

The **Random Tagged Note Plugin** for Obsidian is a powerful tool designed for structured, tag-based study sessions within your vault. Use it to select notes based on tags and folders and track your progress on specific questions. This plugin is ideal for anyone looking to use Obsidian as a flashcard or spaced-repetition study tool.

## Features

- Randomly select notes based on tags and folders.
- Track attempts and correct answers within each note.
- View progress overviews by tag and note.
- Integrate with templates for easy setup.

## Usage

### Setting Up Your Notes and Folder

- **Create a Folder**: Organize your notes by creating a dedicated folder for study materials or questions, such as `/StudyNotes/`.
- **Tag Your Notes**: Inside each note you want to track, add tags related to the topic or difficulty level (e.g., `#math`, `#easy`, or `#review`).
- **Add the Plugin's Placeholder Code Block**: To enable tracking for a note, add the following code block inside your note:
  
  progress-tracker

  This block will display your current stats and answer buttons. **Note:** You must be in **View Mode** for the plugin's buttons and statistics to appear.

### Starting a Session

- Click on the dice icon in the left ribbon to start a session.

  ![Dice Icon to Start Session](https://your-image-link.com/dice-icon.png)

### Select Folder and Tags

- **Choose a Folder**: Select the folder where your tagged notes are located.
- **Select Tags**: Choose one or more tags to filter the notes. You can view all tags and their progress status within the folder.

  ![Tag Selection Screen](https://your-image-link.com/tag-selection.png)
  
  *This screen lets you select tags and view progress overviews before starting a session.*

- **Start Practice**: Once at least one tag is selected, click **Start Practice** to begin the session.

### Answering Questions

- When a note opens, use the **Correct** or **Incorrect** buttons in the progress tracker to record your answer.
- After marking your answer, the plugin will automatically open the next note based on your progress (preferring notes with fewer correct attempts).

  ![In-Note Progress Tracker](https://your-image-link.com/in-note-tracker.png)
  
  *The progress tracker inside a note with Correct/Incorrect buttons and stats display.*

### Tracking Progress

- The plugin displays two progress overviews before you start a session:
  - **Tag Progress Overview**: Shows total attempts and correct answers per tag.
  - **Note Progress Overview**: Displays each note's individual progress, including attempts and correct answers.
- These overviews help you understand which tags or notes need more practice.

  ![Progress Overview](https://your-image-link.com/progress-overview.png)
  
  *The Tag and Note Progress Overviews help you keep track of your study progress.*

### Template Integration

To streamline your note creation, you can create a template that includes the plugin's code block. For example, if you use the [Templates Plugin](https://help.obsidian.md/Plugins/Templates), create a template file containing:

---
tags: #yourTag
---

# Question Title

progress-tracker

<!-- Additional content, such as the question or prompt -->

Now, every time you create a new note using this template, the note will be pre-configured for tracking with the Random Tagged Note Plugin.

## Important Notes

- **View Mode Requirement**: The plugin's progress tracker and buttons only appear when the note is in **View Mode**. Switch to View Mode to interact with the progress tracker.
- **Compatible with Templates**: Easily add the progress tracker to new notes by creating a template with the code block.

## Contributing

If you'd like to contribute, please fork the repository and submit a pull request. Issues and feature requests are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
