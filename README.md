# AutoCacti Map Creator

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
</p>

**AutoCacti Map Creator** is a powerful and intuitive web application that streamlines the process of creating network topology maps for Cacti Weathermap. Move beyond manual configuration files and embrace a modern, visual, drag-and-drop interface to design, arrange, and export your network diagrams effortlessly.

## ✨ Key Features

-   **Interactive Map Editor**: Build your network diagram visually using a drag-and-drop interface powered by React Flow.
-   **Automated Device Discovery**: Start with a single device IP and automatically discover its neighbors via SNMP (mocked).
-   **Dynamic Node Creation**: Add devices, end-points, and descriptive text nodes to the map.
-   **Grouping & Layering**: Organize your map with customizable groups, shapes, and z-index layering.
-   **Alignment & Distribution Tools**: Precisely align and distribute nodes for a clean and professional look.
-   **Backend Processing**: A robust Flask backend handles map generation, image processing, and task management.
-   **Automated Cacti Config Generation**: The application automatically generates the Weathermap `.conf` file based on your visual layout.
-   **Multi-Tenancy Support**: Upload a single map design to multiple Cacti installation groups simultaneously.
-   **Theming & Localization**: Supports both Light and Dark modes, with multi-language support (EN/HE).
-   **Authentication**: Secure JWT-based authentication for protecting access.

## 🏗️ Architecture Overview

The application follows a modern client-server architecture, with a distinct separation between the frontend and backend.

-   **Frontend**: A Single Page Application (SPA) built with **React**. It is responsible for all user interactions, rendering the map canvas, and managing the visual state of the network diagram.
-   **Backend**: A **Python Flask** API that serves as the brain of the operation. It handles authentication, simulates network data retrieval, processes the map data submitted by the frontend, and generates the final Cacti-compatible assets.

### System Architecture Diagram

```mermaid
graph TD
    subgraph "User's Browser"
        A[React Frontend]
    end

    subgraph "Server"
        B[Flask Backend API]
        C[Mock Network & Cacti Data]
        D[Static Files <br/> (Generated Maps, Configs)]
    end

    A -- (1) Login & API Requests (Axios) --> B
    B -- (2) Serves React App & Static Assets --> A
    B -- (3) Fetches Device/Neighbor Info --> C
    B -- (4) Writes/Reads Generated Files --> D