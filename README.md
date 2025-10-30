# AutoCacti Map Creator

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
</p>

**AutoCacti Map Creator** is a powerful and intuitive web application that streamlines the process of creating network topology maps for Cacti Weathermap. Move beyond manual configuration files and embrace a modern, visual, drag-and-drop interface to design, arrange, and export your network diagrams effortlessly.

<p align="center">
<img width="1919" height="949" alt="image" src="https://github.com/user-attachments/assets/1f1dbea1-cfb2-4087-b214-48224d32ed74" />
</p>
<p align="center">
<img width="896" height="802" alt="image" src="https://github.com/user-attachments/assets/81a53d04-099f-48bb-9c73-e07bd21a4370" />
</p>

## ✨ Key Features

-   **Interactive Map Editor**: Build your network diagram visually using a drag-and-drop interface powered by React Flow.
-   **Automated Device Discovery**: Start with a single device IP and automatically discover its neighbors via SNMP (mocked).
-   **Dynamic Node Creation**: Add devices, end-points, and descriptive text nodes to the map.
-  	**Grouping & Layering**: Organize your map with customizable groups, shapes, and z-index layering.
-  	**Alignment & Distribution Tools**: Precisibly align and distribute nodes for a clean and professional look.
-  	**Backend Processing**: A robust Flask backend handles map generation, image processing, and task management.
-  	**Automated Cacti Config Generation**: The application automatically generates the Weathermap `.conf` file based on your visual layout.
-  	**Multi-Tenancy Support**: Upload a single map design to multiple Cacti installation groups simultaneously.
-  	**Theming & Localization**: Supports both Light and Dark modes, with multi-language support (EN/HE).
-  	**Authentication**: Secure JWT-based authentication for protecting access.

## 🏗️ Architecture Overview

The application follows a modern client-server architecture, with a distinct separation between the frontend and backend.

-  	**Frontend**: A Single Page Application (SPA) built with **React**. It is responsible for all user interactions, rendering the map canvas, and managing the visual state of the network diagram.
-  	**Backend**: A **Python Flask** API that serves as the brain of the operation. It handles authentication, simulates network data retrieval, processes the map data submitted by the frontend, and generates the final Cacti-compatible assets.

### System Architecture Diagram

```mermaid
graph TB
    subgraph Browser["🌐 User's Browser"]
        A["⚛️ React Frontend<br/><small>Interactive UI</small>"]
    end
    
    subgraph Server["🖥️ Server Infrastructure"]
        B["🔧 Flask Backend API<br/><small>REST Endpoints</small>"]
        C["📊 Mock Network & Cacti Data<br/><small>Device Information</small>"]
        D["📁 Static Files<br/><small>Generated Maps & Configs</small>"]
    end
    
    A -->|"① Login & API Requests<br/>(Axios)"| B
    B -->|"② Serves React App<br/>& Static Assets"| A
    B -->|"③ Fetches Device<br/>& Neighbor Info"| C
    B <-->|"④ Writes/Reads<br/>Generated Files"| D
    
    classDef browserStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000
    classDef serverStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000
    classDef componentStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#000
    
    class Browser browserStyle
    class Server serverStyle
    class A,B,C,D componentStyle
```
