# ExamPrep

![ExamPrep Plugin Screenshot](./docs/ExamPrep-preview.png)

## What is it?

ExamPrep is an Obsidian plugin designed to help users create structured study sessions with tagged notes. It allows users to select notes based on specific tags, track their attempts and correct answers, and view overall progress summaries.

## Key Highlights

- **Random Note Selection by Tag**: Select notes within a specified folder based on one or more tags.
  
  ![Tag Selection Screen](./docs/tag-selection.png)

- **Progress Tracking**: Track your attempts and correct answers within each note. The plugin adds a progress tracker inside the note with buttons to mark answers as Correct or Incorrect.

  ![In-Note Progress Tracker](./docs/in-note-tracker.png)

- **Progress Overview**: View comprehensive progress summaries by tag and note. This overview helps you quickly see which areas you need to focus on.

  ![Progress Overview](./docs/progress-overview.png)

- **Template Integration**: Easily create new study notes with templates that include the progress tracker code block.

## How to Use

### Setting Up Your Notes and Folder

1. **Create a Study Folder**: Organize your study materials by creating a dedicated folder for them, such as `/StudyNotes/`.
  
2. **Tag Your Notes**: Add tags to each note that you want to track. Tags can represent topics, difficulty levels, or anything relevant to your study sessions (e.g., `#math`, `#easy`, `#review`).

3. **Add the Progress Tracker Code Block**: To enable tracking within a note, add the following code block inside each note:

   \```progress-tracker

   This code block activates the progress tracker, where you’ll see buttons to mark attempts as correct or incorrect. **Note:** Make sure to be in **View Mode** to interact with the progress tracker.

### Starting a Study Session

- Click on the dice icon in the left ribbon to start a study session with ExamPrep.

  ![Dice Icon to Start Session](./docs/dice-icon.png)

### Select Folder and Tags

- **Choose a Folder**: Select the folder where your study notes are located.
  
- **Select Tags**: Filter notes by selecting one or more tags from the available options. ExamPrep will display progress summaries for each tag, helping you track your overall progress.

- **Start Practice**: Once you've selected a folder and at least one tag, click **Start Practice** to begin.

### Answering Questions and Tracking Progress

- As each note opens, use the **Correct** or **Incorrect** buttons to track your answer.
- The plugin automatically opens the next note based on your progress (prioritizing notes with fewer correct attempts).
- To view your progress, refer to the **Tag Progress Overview** and **Note Progress Overview** at the start of each session.

### Integrating with Templates

To make it easy to add new study notes, you can set up a template that includes the progress tracker code block. Using the [Templates Plugin](https://help.obsidian.md/Plugins/Templates), create a template with the following structure:


```md
#tag1 #tag2 #tag3

##### Question: 
<!-- Additional content, such as the question, a screenshot of the exercise etc. -->
##### Solution: 
<!-- Additional content, such as the solution, a screenshot of the exercise etc. -->

```progress-tracker
```

With this setup, each new note created with the template will automatically include the progress tracker and tag configuration.

## Development

To customize this project for your needs, clone it and then install all dependencies:

```sh
git clone https://github.com/yllias/ExamPrep-Obsidian
cd ExamPrep
npm install
```

## Important Notes

- **View Mode Requirement**: The plugin's progress tracker and buttons only appear when the note is in **View Mode**. Switch to View Mode to interact with the progress tracker.
- **Compatible with Templates**: Easily add the progress tracker to new notes by creating a template with the code block.

## Contributing

If you'd like to contribute, please fork the repository and submit a pull request. Issues and feature requests are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
